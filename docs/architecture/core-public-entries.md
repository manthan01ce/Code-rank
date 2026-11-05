# Core public entries (#97 / batch 5B)

Structural implementation on `refactor/batch5-core-public-entries`, from master
`34c34006edd4a95efed68197e61dfdb81f98b049`. Scoped real PostgreSQL/Redis regression acceptance is recorded in [the follow-up evidence](core-facades-acceptance.md).
The [baseline consumer inventory](core-public-entries-consumers.json) records original
file/line/source observations, including mocks; it is historical evidence, not a list
of supported imports. The [matrix](local-lab-matrix.json) separates this structural
change from unverified functional acceptance.

## Caller disposition

| Original entry | Observed consumers | Supported destination / disposition |
| --- | --- | --- |
| `@coderank/core/db`, `src/db/client.js` | API feature services, core policy/authentication/query helpers, worker bootstrap/publisher, test mocks | `@coderank/database`; default client and named `closeDatabase` share the database package implementation. Worker now declares its direct database dependency. |
| `src/db/readiness.js`, `@coderank/core/db-readiness` | No executable callers; stale health route inventory only. Operations already imports database readiness directly. | `@coderank/database/readiness`; facade and stale alias removed. |
| `src/db/migrate.js` | No callers in apps/packages/scripts/tests/workflows or npm commands | Removed import-side-effect shim. `npm run db:migrate`, quick-checks and `scripts/ci/container-topology.mjs` already invoke `packages/database/scripts/run-migration.js` explicitly; no replacement import added. |
| `services/PracticalService` | API execution, realtime, student practical and submission services; developer `check_user.mjs` used the implementation directly | Existing `@coderank/core/practicals` export to the single core implementation. |
| `services/SubmissionService` | API bootstrap, operations, execution, realtime, submission services, developer `check_user.mjs`, health mock | Existing `@coderank/core/submissions` export; grading and persistence remain in core. |
| `services/CourseService` | API practical selector; selector pagination test also used the implementation directly | `@coderank/core/courses` exports the existing course read service directly. |
| `services/UserService`, `modules/users/UserService.js` | Pagination test; unused binding in admin-bootstrap test; no application or script caller | Remove both facade and redundant API-only implementation. Pagination test now exercises API `UserManagementService.listUsers`; admin-bootstrap continues testing actual `AuthService`. API `UsersService.validateDivision` remains its existing owner. No core-to-API dependency. |
| Root `@coderank/core` / `src/index.js` | No importers in repository; only its own exports | Remove broad barrel, `main` and `.` export. Use explicit feature/security/shared entries. |
| `modules/courses/list-pagination.js`, `@coderank/core/pagination` | API course catalog and selector pagination test | Existing `@coderank/core/shared/pagination`, one implementation. |
| `utils/logger` | Worker bootstrap/system jobs; unused root re-export | Move implementation to `shared/logger`, migrate both workers; no compatibility wrapper. |
| `utils/request-timing` | API auth/user routes and auth-resilience test | Move unchanged implementation to `shared/request-timing`. It is a dependency-free duration collector/formatter with the existing privacy allowlist; HTTP adapters retain header delivery. |
| `utils/timeout` | API operations, realtime and rate limiter; core submission queue operations | Move unchanged implementation to `shared/timeout`, migrate consumers. Database's existing internal timeout remains database-owned to preserve the one-way infrastructure boundary; it is not a core facade or business service. |

All packages are private workspaces. No external supported consumer or published
compatibility promise was found for the retired entries in code, manifests, workflows
or current documentation. No legacy alias is retained on an assumed external-consumer
basis. Other existing security/auth/config/circuit-breaker entries retain their
implementations and public contracts. The unused `core/src/db/queries/index.js` is a
query-helper implementation, not a database client facade; it now imports the database
owner directly, has no public export, and is outside this retirement scope.

The old database-assets consumer inventory, predecessor patches, baseline and folder
snapshot remain explicitly historical. Route inventory references are updated to
current owners without altering endpoint contracts. No workflow trigger, expensive
label, Vercel policy, SQL asset, ledger format or volume identity changes.

## Regression boundaries and acceptance

`tests/architecture/core-public-entries.test.mjs` scans imports, re-exports, dynamic
imports, require calls, module mocks and URL references across apps/packages/scripts/tests.
It rejects retired aliases/files, resolves core/database package entries from each
consumer, exercises ESM linking, and prevents runtime imports of migration entries.
Existing ownership tests keep API-only features out of core and grading out of runner.
`tests/unit/worker-import.test.mjs` imports bootstrap with lifecycle allocations isolated
and verifies the real database `closeDatabase` export reaches drain. This is an import
smoke test, not real worker/recovery acceptance.

Required final-head evidence: clean `npm ci`, critical lint, strict `npm test`, API build,
focused pagination/auth/session/users/reports/submission/grading/worker tests, disposable
PostgreSQL actor ordering and ledger/readiness/grading, and real worker regressions.
The [follow-up acceptance record](core-facades-acceptance.md) describes the now-executed native database and Redis regressions; its PR records exact SHA, commands, exits and limitations. Broader Docker/compiler/lab certification is separate. Expensive Actions remain stopped; deployment/college/LAN/cloud work is outside this issue.
