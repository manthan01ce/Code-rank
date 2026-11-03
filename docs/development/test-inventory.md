# CodeRank Test Inventory

**Issue:** CR-ARCH-23
**Last updated:** 2026-11-03
**Inventory source revision:** master `ff9e0b8261af036d242b7a8322a38dc4735fd2b8` plus the two launcher/seed regression files in this correction. Counts describe files, not assertions.

This document records the intended test file inventory, suite routing, tools, quarantine list, and the before/after change summary introduced by CR-ARCH-23. It is the authoritative reference for understanding which tests belong to which CI lane and why.

---

## 1. Test Suites and Lane Routing

| Lane | npm script | Runner | Discovery |
|---|---|---|---|
| **unit** | `npm test` | `scripts/ci/run-tests.mjs unit` | All `tests/*.test.mjs` and `tests/*.test.js` except explicitly quarantined files |
| **integration** | `npm run test:integration` | `scripts/ci/run-tests.mjs integration` | Explicit list: `queue`, `realtime`, `worker-readiness`, `worker-recovery`, `postgres` |
| **docker** | `npm run test:docker` | `scripts/ci/run-tests.mjs docker` | Single file: `tests/integration/sandbox.test.mjs` |
| **redis** | `npm run test:redis` | `node --test` (direct) | `queue`, `realtime`, `worker-readiness`, `worker-recovery` |
| **postgres** | `npm run test:postgres` | `node --test` (direct) | `tests/integration/postgres.test.mjs` |
| **neon** | `npm run test:neon` | `node --test` (direct) | `neon.test.mjs`, `neon-upgrade.test.mjs` |
| **browser** | `npm run test:authenticated` | Playwright via `scripts/authenticated-stack.mjs` | `tests/browser/*.spec.mjs` |
| **stack** | `npm run test:stack` | `scripts/stack-smoke.mjs` | Full web-to-worker round-trip (not node:test) |

---

## 2. Unit Lane — Intended File Inventory

At the recorded source revision plus this correction, 63 root `.test.mjs` files plus `job-lifecycle.test.js` give 64 discovered unit test files. `batch-execution.test.js` is the one explicitly quarantined root test; it is not counted as executed. This file count is separate from the number of assertions reported by TAP.

Discovery rule: `tests/` root directory, `*.test.mjs` OR `*.test.js`, excluding files in `UNIT_QUARANTINE` (defined in `scripts/ci/run-tests.mjs`).

### 2.1 `.test.mjs` files (63 files)

| File | What it covers |
|---|---|
| `tests/active-actor.test.mjs` | JWT authentication middleware, actor resolution |
| `tests/admin-api.test.mjs` | Admin HTTP route contracts |
| `tests/admin-bootstrap.test.mjs` | Admin account initialization logic |
| `tests/admin-transactions.test.mjs` | Admin database transaction helpers |
| `tests/api-input-contracts.test.mjs` | Input validation for API routes |
| `tests/api-route-contracts.test.mjs` | Route fixture parity check against `tests/fixtures/routes.json` |
| `tests/architecture.test.mjs` | Route inventory validation, dependency boundaries, HTTP method checks, discovery coverage |
| `tests/auth-resilience.test.mjs` | Auth retry and session resilience |
| `tests/browser-socket-auth.test.mjs` | Browser socket auth helper contract |
| `tests/bulk-users-api.test.mjs` | Bulk user import API contracts |
| `tests/capacity.test.mjs` | Execution queue capacity gate |
| `tests/certification.test.mjs` | CI certification artifact validation |
| `tests/ci-tap.test.mjs` | TAP validator unit tests |
| `tests/cluster-config.test.mjs` | Cluster/worker process config validation |
| `tests/course-management-service.test.mjs` | Course management service logic |
| `tests/course-management-sql.test.mjs` | Course management SQL queries |
| `tests/course-report.test.mjs` | Course report generation |
| `tests/database-client.test.mjs` | Database client connection/pool contract |
| `tests/database-no-replay.test.mjs` | Database migration replay guard |
| `tests/database-ops.test.mjs` | Database operations helper functions |
| `tests/deployment-readiness.test.mjs` | Deployment readiness manifest checks |
| `tests/execution-api.test.mjs` | Execution API helper contracts (enqueueExecution, practiceHandler) |
| `tests/execution-security.test.mjs` | Execution payload validation and security guards |
| `tests/extracted-read-services.test.mjs` | Read-only service extraction contracts |
| `tests/faculty-mapping-authority.test.mjs` | Faculty-to-course mapping authority checks |
| `tests/fetch-collection.test.mjs` | Fetch collection utility |
| `tests/function-harness.test.mjs` | Function harness execution contracts |
| `tests/grading.test.mjs` | Submission grading logic |
| `tests/health.test.mjs` | Health endpoint logic |
| `tests/job-wait.test.mjs` | Job polling wait utility |
| `tests/load-result.test.mjs` | Load test result parsing |
| `tests/migration-errors.test.mjs` | Migration error handling |
| `tests/migrations.test.mjs` | Migration checksum and ordering |
| `tests/password-session.test.mjs` | Password change and session rotation |
| `tests/postgres-client.test.mjs` | PostgreSQL client contracts |
| `tests/practical-navigation.test.mjs` | Practical page navigation helper |
| `tests/profile-privacy.test.mjs` | Profile privacy and visibility rules |
| `tests/progress-updates.test.mjs` | Progress update broadcasting |
| `tests/rate-limit.test.mjs` | Rate limiter contracts |
| `tests/realtime.test.mjs` | Realtime event handler unit contracts |
| `tests/realtime-membership.test.mjs` | Room membership authorization |
| `tests/realtime-revocation.test.mjs` | Session revocation on token expiry |
| `tests/realtime-session.test.mjs` | Session guard timer and revalidation logic |
| `tests/request-revocation.test.mjs` | In-flight request revocation |
| `tests/retention.test.mjs` | Data retention utility |
| `tests/runner.test.mjs` | Runner language dispatch |
| `tests/sandbox.test.mjs` | Sandbox lifetime bounds and isolation flags using an injected Docker command adapter |
| `tests/sandbox-recovery.test.mjs` | Sandbox container recovery after crash |
| `tests/schema-readiness.test.mjs` | Schema readiness manifest validation |
| `tests/selector-pagination.test.mjs` | Keyset pagination selector |
| `tests/static-runners.test.mjs` | Static language runner contracts |
| `tests/student-theme.test.mjs` | Student theme utility |
| `tests/submission-history.test.mjs` | Submission history retrieval |
| `tests/submission-reset.test.mjs` | Submission reset authorization |
| `tests/user-management-api.test.mjs` | User management HTTP route contracts |
| `tests/user-management-sql.test.mjs` | User management SQL queries |
| `tests/user-pagination.test.mjs` | User list keyset pagination |
| `tests/worker-config.test.mjs` | Worker concurrency and config validation |
| `tests/worker-heartbeat.test.mjs` | Worker heartbeat monitor |
| `tests/worker-shutdown.test.mjs` | Worker graceful shutdown |

| `tests/ci-summary.test.mjs` | Outcome-based CI summary and dynamic count reporting |

| `tests/lab-launcher-env.test.mjs` | Dotenv precedence, literal values, native launcher handoff and exit-code propagation |

| `tests/seed-safety.test.mjs` | Destructive seed refusal before configuration or database connection |

### 2.2 `.test.js` files in unit lane (1 file)

| File | What it covers | Extension rationale |
|---|---|---|
| `tests/job-lifecycle.test.js` | `waitForJob`, `boundedFetch`, `responseError` (job polling lifecycle), `practicalPassed` (verdict helper). No Docker or network dependencies. 11 assertions, all passing. | Pre-dates the `.mjs` convention; uses ESM `import` syntax. Extension retained deliberately; both extensions are supported by the unit lane. |

---

## 3. Quarantine List

Files explicitly excluded from the unit lane, with documented reason, owner, and restoration condition.

| File | Quarantine reason | Suite it belongs to | Restoration condition | Owner |
|---|---|---|---|---|
| `tests/batch-execution.test.js` | Legacy test creates a fake docker executable intended to run generated shell locally, but its command shim predates the current Sandbox run/exec lifecycle. Its failure is not sufficient evidence that merely installing Docker fixes it. Batch framing, per-case errors/timeouts and continued execution still need restoration against the current Executor. | Intended future docker lane; NOT currently selected by any lane | CR-ARCH-24 must modernize this test against the current Executor, run it with real disposable Docker, register it in the docker lane, and only then remove quarantine. File relocation alone is insufficient. | CR-ARCH-24 |

---

## 4. Integration Lane — File Inventory

Run by `npm run test:integration` → `scripts/ci/run-tests.mjs integration`.

| File | Services required |
|---|---|
| `tests/integration/queue.test.mjs` | Redis |
| `tests/integration/realtime.test.mjs` | Redis |
| `tests/integration/worker-readiness.test.mjs` | Redis |
| `tests/integration/worker-recovery.test.mjs` | Redis, PostgreSQL |
| `tests/integration/postgres.test.mjs` | PostgreSQL |

Not in the integration lane (separate scripts):

| File | Script | Services required |
|---|---|---|
| `tests/integration/neon.test.mjs` | `npm run test:neon` | Neon cloud DB |
| `tests/integration/neon-upgrade.test.mjs` | `npm run test:neon` | Neon cloud DB |

---

## 5. Docker Lane — File Inventory

Run by `npm run test:docker` → `scripts/ci/run-tests.mjs docker`.

| File | Services required |
|---|---|
| `tests/integration/sandbox.test.mjs` | Docker daemon, `coderank-base:latest` image |

**Quarantined (pending move to this lane):**

| File | Notes |
|---|---|
| `tests/batch-execution.test.js` | See Section 3 above |

---

## 6. Browser Lane — File Inventory

Run by `npm run test:authenticated` → `scripts/authenticated-stack.mjs`.

| File | Services required |
|---|---|
| `tests/browser/auth-performance.spec.mjs` | Running web + worker stack, Playwright browser |
| `tests/browser/role-workflows.spec.mjs` | Running web + worker stack, Playwright browser |

Config: `tests/browser/playwright.config.mjs`

---

## 7. Fixture and Helper Files (not test entry points)

These files live in `tests/` but are not test entry points and must not appear in any discovery lane.

| File | Role |
|---|---|
| `tests/fixtures/routes.json` | Legacy route fixture consumed by `api-route-contracts.test.mjs` |
| `tests/fixtures/crashing-worker.mjs` | Worker crash fixture imported by `worker-recovery.test.mjs` |
| `tests/fixtures/sandbox-owner.fixture.mjs` | Sandbox ownership fixture |
| `tests/fixtures/ci/protocol.fixture.mjs` | CI protocol fixture |

---

## 8. Before / After: CR-ARCH-23

### Before (original discovery baseline at `051a654e`)

| Aspect | State |
|---|---|
| Unit lane discovery | `tests/*.test.mjs` only |
| `tests/job-lifecycle.test.js` | Not discovered — silently omitted from all suites |
| `tests/batch-execution.test.js` | Not discovered — silently omitted from all suites |
| Quarantine documentation | None — omission was undocumented |
| Test inventory document | Did not exist |
| Architecture test coverage | No test verifying discovery rules |

### After (this PR)

| Aspect | State |
|---|---|
| Unit lane discovery | `tests/*.test.mjs` AND `tests/*.test.js`, minus `UNIT_QUARANTINE` |
| `tests/job-lifecycle.test.js` | **Included** in unit lane; 11 assertions pass |
| `tests/batch-execution.test.js` | **Quarantined** with explicit reason, owner (CR-ARCH-24), and restoration condition |
| Quarantine documentation | Declared in `scripts/ci/run-tests.mjs` as `UNIT_QUARANTINE` set |
| Test inventory document | This file (`docs/development/test-inventory.md`) |
| Architecture test coverage | `tests/architecture.test.mjs` has a new test verifying both extensions discovered, quarantine respected, no fixtures/integration/browser files leaked |

---

## 9. Tools

| Tool | Version pinned in | Purpose |
|---|---|---|
| Node.js test runner (`node:test`) | `engines.node: ">=24.0.0"` in root `package.json` | Native test runner for all `.test.mjs` and `.test.js` files |
| TAP validator | `scripts/ci/verify-tap.mjs` | Strict TAP output validation; no skips/todos/failures permitted |
| Playwright | `@playwright/test@1.56.1` in root `devDependencies` | Browser end-to-end tests |
| ESLint | `apps/web/eslint.config.mjs` | Lint critical paths (not a test runner) |

---

## 10. Invariants (must be preserved by all future issues)

1. `UNIT_QUARANTINE` in `scripts/ci/run-tests.mjs` is the single authoritative exclusion list for the unit lane. Never silently omit a test file — either include it or add it to `UNIT_QUARANTINE` with a documented reason.
2. Fixture files and integration/browser specs must never appear in unit lane discovery.
3. The architecture test `unit test discovery includes both .test.mjs and .test.js files and respects explicit quarantine` must continue to pass after any change to test discovery.
4. No gate weakening: `verifyTap` strict validation, timeout, zero-failure policy remain unchanged.
5. CR-ARCH-24 owns the move of `batch-execution.test.js` to the docker lane. Until that PR merges, the file stays quarantined here.
