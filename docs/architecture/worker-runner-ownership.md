# Worker and runner ownership (#77, #78 runner-grouping follow-up)

Baseline: master 34c34006edd4a95efed68197e61dfdb81f98b049 (PR #95). #70–#80 predecessors merged; runner-grouping refactor is independent within batch 5.

| Responsibility | Owner and actual consumers |
| --- | --- |
| Bootstrap/environment/signals | `apps/worker/src/index.js` creates the two queue workers, heartbeat, reaper and bounded drain |
| BullMQ execution processor and job dispatch | `apps/worker/src/jobs/execution/submission.worker.js` and `dispatch.js`; `index.js` consumes the factory |
| Dynamic practical orchestration | `apps/worker/src/jobs/execution/dynamic.js` injects runner `Executor` into core `gradePractical` |
| Playground execution and public result shaping | `apps/worker/src/jobs/execution/playground.js` preserves compile/run/finally-cleanup; processor applies core `publicResult` |
| System queue | `apps/worker/src/jobs/system/system.worker.js`, including health/log tasks |
| Worker service-token refresh and completion/failure notifications | `apps/worker/src/realtime/publisher.js`; execution processor consumes it |
| Heartbeat, readiness lease and bounded shutdown | `apps/worker/src/lifecycle/heartbeat.js` and `shutdown.js`; bootstrap consumes both |
| Shared single Executor | `packages/runner/src/Executor.js` provides single shared multi-language compile/execution engine |
| Language implementations | `packages/runner/src/languages/` contains all language-specific execution and test harness logic |
| Sandbox lifecycle, health and reaping | `packages/runner/src/sandbox/` encapsulates Docker transport, container lifecycle, metadata, health probing, and reaper |
| Grading, late/attempt rules, normalization and durable persistence | `packages/core/src/modules/submissions/GradingService.js` and `SubmissionRepository.js` remain unchanged; worker imports explicit core/grading |
| Historical verdict helper | `packages/core/src/modules/submissions/legacy-verdict.js`, consumed only by regression tests |

---

## Runner Package Architecture and Grouping

`packages/runner` public exports are preserved in `packages/runner/package.json`:
- `.` &rarr; `./src/Executor.js`
- `./sandbox` &rarr; `./src/sandbox/Sandbox.js`
- `./languages` &rarr; `./src/languages/index.js`
- `./docker` &rarr; `./src/sandbox/docker.js`
- `./reaper` &rarr; `./src/sandbox/reaper.js`
- `./function-harness` &rarr; `./src/languages/function-harness.js`
- `./function-runner` &rarr; `./src/languages/function-runner.js`
- `./health` &rarr; `./src/sandbox/health.js`

Language-specific implementations are grouped under `packages/runner/src/languages/` and container lifecycle/metadata/health/reaping under `packages/runner/src/sandbox/`. No manufactured compatibility files or stubs are left in `src/`. The shared `Executor` remains a single implementation at `packages/runner/src/Executor.js`.

### Before and After File-to-Owner Map

| Former flat path | New grouped path | Responsibility & Owner |
|---|---|---|
| `packages/runner/src/Executor.js` | `packages/runner/src/Executor.js` *(unchanged)* | Shared executor, budget enforcement, batch and playground runs |
| `packages/runner/src/languages.js` | `packages/runner/src/languages/index.js` | Language registry and runner barrel export (`@coderank/runner/languages`) |
| `packages/runner/src/c.js` | `packages/runner/src/languages/c.js` | C language function execution harness adapter |
| `packages/runner/src/cpp.js` | `packages/runner/src/languages/cpp.js` | C++ language execution, compilation and test harness |
| `packages/runner/src/java.js` | `packages/runner/src/languages/java.js` | Java language execution, compilation and JSON test runner |
| `packages/runner/src/javascript.js` | `packages/runner/src/languages/javascript.js` | JavaScript language function execution harness adapter |
| `packages/runner/src/python.js` | `packages/runner/src/languages/python.js` | Python language execution, AST check and test runner |
| `packages/runner/src/function-harness.js` | `packages/runner/src/languages/function-harness.js` | Function problem code generator and test case generator |
| `packages/runner/src/function-runner.js` | `packages/runner/src/languages/function-runner.js` | Function problem runner orchestration |
| `packages/runner/src/Sandbox.js` | `packages/runner/src/sandbox/Sandbox.js` | Ephemeral container lifecycle, retired warm-config rejection, and deadline management |
| `packages/runner/src/docker.js` | `packages/runner/src/sandbox/docker.js` | Docker process invocation over stdin (`dockerCommand`) |
| `packages/runner/src/health.js` | `packages/runner/src/sandbox/health.js` | Docker daemon and runner image health inspection |
| `packages/runner/src/sandbox-metadata.js` | `packages/runner/src/sandbox/metadata.js` | Sandbox labels, ownership UUID, prefix, and scope validation |
| `packages/runner/src/reaper.js` | `packages/runner/src/sandbox/reaper.js` | Expired sandbox detection, batch reaping, and periodic cleanup loop |

### Naming Differences and Consumer Resolution

1. `languages.js` &rarr; `languages/index.js`: Standard folder barrel. Resolved via public export `@coderank/runner/languages`.
2. `sandbox-metadata.js` &rarr; `sandbox/metadata.js`: Simplified name inside `src/sandbox/`. Consumed internally by `src/sandbox/Sandbox.js` and `src/sandbox/reaper.js`.
3. `tests/unit/static-runners.test.mjs`: Node `mock.module` target updated from `../../packages/runner/src/docker.js` to `../../packages/runner/src/sandbox/docker.js` to match the exact module URL imported by language runners.
4. `tests/unit/worker-dispatch.test.mjs`: Runner independence test updated to recursively verify all `.js` files across `src/`, `src/languages/`, and `src/sandbox/` against forbidden application/core/database imports.

---

## Consumer Inventory

| Consumer | Imported Runner Public Export | Purpose |
|---|---|---|
| `apps/worker/src/index.js` | `@coderank/runner/sandbox` (`startSandboxReaper`) | Starts background reaper during worker startup |
| `apps/worker/src/jobs/execution/dispatch.js` | `@coderank/runner/languages` (`practiceRunners`) | Dispatches practical jobs to appropriate language runner |
| `apps/worker/src/jobs/execution/dynamic.js` | `@coderank/runner` (`Executor`) | Injects shared Executor into core `gradePractical` |
| `apps/worker/src/jobs/execution/playground.js` | `@coderank/runner` (`Executor`), `@coderank/runner/languages` (`ALLOWED_LANGUAGES`) | Compiles and executes untrusted code for interactive playground |
| `apps/worker/src/jobs/execution/submission.worker.js` | `@coderank/runner/sandbox` (`jobLifetime`) | Computes bounded lock and execution durations |
| `apps/worker/src/jobs/system/system.worker.js` | `@coderank/runner/health` (`checkDockerHealth`) | Periodic health check job |
| `apps/worker/src/lifecycle/heartbeat.js` | `@coderank/runner/health` (`checkDockerHealth`) | Probes Docker daemon/image before advertising healthy worker |
| `apps/worker/src/lifecycle/shutdown.js` | `@coderank/runner/sandbox` (`jobLifetime`) | Bounded drain timeout calculation |
| `scripts/ops/reap-sandboxes.mjs` | `@coderank/runner/reaper` (`reapExpiredSandboxes`) | Ops CLI for manual/scheduled sandbox reaping |
| `tests/docker/batch-execution.test.js` | `@coderank/runner`, `@coderank/runner/docker` | Quarantined batch execution test |
| `tests/docker/sandbox.test.mjs` | `@coderank/runner`, `@coderank/runner/sandbox`, `@coderank/runner/docker`, `@coderank/runner/languages`, `@coderank/runner/reaper` | Real cold Docker container isolation and execution verification |
| `tests/fixtures/sandbox-owner.fixture.mjs` | `@coderank/runner/sandbox` (`Sandbox`) | Subprocess sandbox fixture for recovery drills |
| `tests/unit/function-harness.test.mjs` | `@coderank/runner/function-harness` | Function problem code generation unit tests |
| `tests/unit/runner.test.mjs` | `@coderank/runner` (`Executor`, `executionBudget`) | Executor workspace, budget, and test case unit tests |
| `tests/unit/sandbox.test.mjs` | `@coderank/runner/sandbox` (`Sandbox`, `jobLifetime`), `@coderank/runner/docker` (`dockerCommand`) | Sandbox isolation, lifetime, and retired warm-config tests |
| `tests/unit/sandbox-recovery.test.mjs` | `@coderank/runner/reaper`, `@coderank/runner/sandbox` | Metadata validation, expiry checks, and reaper unit tests |
| `tests/unit/static-runners.test.mjs` | `@coderank/runner/languages` | Mocked static language runner tests |
| `tests/unit/worker-dispatch.test.mjs` | `@coderank/runner/languages` | Language capability registry and runner dependency boundary check |

---

## Runtime contracts preserved

- Complete resource isolation (`--network none`, `--read-only`, `--cap-drop ALL`, `--security-opt no-new-privileges:true`, `--pids-limit 64`, `--memory 512m`, `--memory-swap 512m`, `--cpus 1`, UID 1000).
- Ephemeral container cleanup via `finally { await sandbox.destroy(); }` and background reaping via `startSandboxReaper`.
- Cold per-job execution; enabled legacy warm configuration is rejected explicitly. See the #99 retirement candidate and pending real Docker acceptance.
- Five-second execution caps, compiler budgets (10s), and bounded container lifetime (`sleep <lifetime>`).
- Package boundary isolation: runner does not import from core, database, or applications.
- API maintains zero runner and Docker dependencies.
