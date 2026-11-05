# Worker and runner ownership (#77)

Baseline: master a1e7192ca8fb45862a873ea5a4f89dc1915fcf42, pulled successfully on a clean tree. #70 is merged; #77 is independent of frontend work and database asset relocation after that prerequisite. The merged #76 assets are preserved.

| Responsibility | Owner and actual consumers |
| --- | --- |
| Bootstrap/environment/signals | worker/src/index.js creates the two queue workers, heartbeat, reaper and bounded drain |
| BullMQ execution processor and job dispatch | worker/src/jobs/execution/submission.worker.js and dispatch.js; index.js consumes the factory |
| Dynamic practical orchestration | jobs/execution/dynamic.js injects runner Executor into core gradePractical |
| Playground execution and public result shaping | jobs/execution/playground.js preserves compile/run/finally-cleanup; processor applies core publicResult |
| System queue | jobs/system/system.worker.js, including health/log tasks |
| Worker service-token refresh and completion/failure notifications | realtime/publisher.js; execution processor consumes it |
| Heartbeat, readiness lease and bounded shutdown | lifecycle/heartbeat.js and shutdown.js; bootstrap consumes both |
| Docker probing, sandbox, compilers, language/function harness, cleanup/reaping | packages/runner public root, languages, health, sandbox, docker, reaper, function-harness and function-runner exports; worker, maintenance script and runner tests consume them |
| Grading, late/attempt rules, normalization and durable persistence | core/modules/submissions/GradingService.js and SubmissionRepository.js remain unchanged; worker imports the explicit core/grading entry |
| Historical verdict helper | core/modules/submissions/legacy-verdict.js, consumed only by the existing job-lifecycle regression test; live grading uses GradingService, not this helper |

The former worker Executor and five language files were compatibility re-exports, not duplicate implementations. Their callers now use public runner exports and the files are removed. The former execution/runners index becomes worker-owned playground orchestration, not another executor. Practice dispatch uses one frozen runner capability registry for all five language identifiers. API/core intake policy remains independent of runner imports; a parity test checks the two language sets. No core/database/application implementation is imported by runner, and API still cannot import runner/Docker.

## Consumer inventory before the move

- `apps/worker/src/index.js`
- `apps/worker/src/workers/submission.worker.js`
- `docs/LOCAL_SETUP_VERIFIED.md`
- `docs/architecture/baseline-2026-11.md`
- `scripts/reap-sandboxes.mjs`
- `tests/batch-execution.test.js`
- `tests/fixtures/sandbox-owner.fixture.mjs`
- `tests/function-harness.test.mjs`
- `tests/integration/sandbox.test.mjs`
- `tests/integration/worker-readiness.test.mjs`
- `tests/integration/worker-recovery.test.mjs`
- `tests/job-lifecycle.test.js`
- `tests/runner.test.mjs`
- `tests/sandbox-recovery.test.mjs`
- `tests/sandbox.test.mjs`
- `tests/static-runners.test.mjs`
- `tests/worker-config.test.mjs`
- `tests/worker-heartbeat.test.mjs`
- `tests/worker-shutdown.test.mjs`

All affected static/dynamic script/test imports are updated. The static runner module mock retains its exact implementation URL deliberately so the public language export resolves to the mocked Docker mechanism. The quarantined historical batch test only gets its import updated; its lane/quarantine and assertions are unchanged (modernization belongs to #79).

## Runtime contracts

Queue names, payloads, processor concurrency, jobLifetime + 5000 lock duration and error/stall listeners are unchanged. Dispatch preserves stable job ID, actor and enqueue timestamp for core idempotent attempt persistence. Five-second execution caps, compiler/runtime budgets, sandbox resource isolation and deterministic cleanup/reaping are untouched. Core grading and repository implementations remain in place; no SQL or persistence rule changes.

Publisher extraction preserves service-token callback refresh, explicit server-disconnect reconnection, shutdown reconnect suppression, public hidden-case redaction and actor-scoped submission notification lookup. Heartbeat TTLs, registry identifiers, drain/pause ordering and Redis cleanup are retained. Database close now runs after queue drain within the same finite shutdown deadline, before realtime disconnect. Repeated shutdown signals still share one promise. Existing failure/deadline tests retain their assertions; new tests check database cleanup ordering/deadline as well.

The worker's unused direct dotenv dependency was removed after import analysis: bootstrap still loads core/config/env, whose owning package declares dotenv. npm regenerated the lockfile; the only lockfile change removes that worker declaration, with no unrelated versions changed. Existing Docker COPY packages/worker trees already include all new paths; no image or sandbox-image reorganization is introduced (#78).

## Verification and limits

Clean npm ci, critical lint, the full unit lane and application builds are required. Existing grading, privacy, sandbox/reaping, static runner timeout, heartbeat/recovery, drain, worker configuration and queue tests remain registered with updated imports. New tests cover every language dispatch, actor/job/timestamp binding, invalid modes, runner boundaries, publication redaction and bounded database cleanup.

Real sandbox execution/compile/runtime errors/timeouts across every language/mode, live queue/worker recovery, resource leak/capacity acceptance and the full API-to-worker-to-database-to-browser flow remain pending on this revision: Docker is not installed here. The real integration/Docker/stack/browser lanes are retained, but are not replaced by unit mocks. Per explicit owner direction, full-stack and auth-performance CI stay stopped; no expensive opt-in labels are applied. No database operations, volume changes or deployment changes are performed. Rollback is an application revert.
