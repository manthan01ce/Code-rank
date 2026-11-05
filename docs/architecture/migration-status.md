# Architecture migration status

Database assets/lifecycle ownership is reconciled in [the #76 inventory](database-assets-ownership.md); this move preserves SQL/ledger identity and leaves real container/recovery acceptance pending.

Remaining frontend route and workflow owners are reconciled in [the #74 ownership inventory](remaining-views-ownership.md); runtime/browser acceptance is tracked separately from these implementation moves.

Current implementation after the final separation change: all 47 baseline endpoint groups and Socket.IO are API-owned. Web uses standard Next.js serving without core/database/queue/runner imports or secrets. Public routing lives in infrastructure/gateway; only worker has Docker access. The browser-safe public practice catalog has two real consumers, so it resides in packages/contracts with no backend/environment dependencies. See [current topology](three-app-topology.md). Final PR CI provides completion evidence; historical stage notes below describe their implementation snapshots.


Faculty review/report frontend ownership is extracted in #71; see [method and consumer reconciliation](faculty-review-ownership.md). Runtime separation and API-only core ownership correction (#70) remain distinct from this frontend change.

Reviewed against master `a8425a352cc355c12906c8af93a517f136d610ec` and branch `refactor/cr-arch-13-3i` (CR-ARCH-13 / Issue 3I / #57).

## Historical status after 3I (before the final separation change)

| Area | Current implementation | Recommendation and remaining work |
| --- | --- | --- |
| Applications | `apps/web`, `apps/worker`, `apps/api` | Fastify API workspace created; three application workspaces; complete separation remains scheduled for 3J |
| HTTP | All 47 endpoints migrated to `apps/api/src/modules/` (auth, users, courses, departments, mapping, practicals, execution, submissions, operations, profile); 0 route files remain in `apps/web/src/app/api` | Complete web/API extraction achieved across 3A–3I; final separation and complete removal of web backend imports/secrets scheduled for 3J |
| Realtime | Fastify API owns authoritative Socket.IO; Next.js server proxies `/socket.io` WebSocket upgrades; API publisher broadcasts practical/job changes | Web Socket.IO server completely eliminated; browser hooks and transitional publishers point to API |
| Frontend features | Coding-workspace, practice, credential PDF and practical-authoring extractions landed | Finish submission/reports/user workflows as separate slices; route files assemble views |
| Core | Browser PDF implementation removed; explicit runtime environment export added | Retain only genuinely shared backend rules; move API-only services, retire facades after consumers migrate |
| Tooling | Root tooling includes explicit lint dependencies, backend correctness rules, and covers `apps/api` | Continue expanding checks as each module migrates |
| Database | SQL assets and lifecycle scripts still under root `database/` | Consolidate under database package without changing migration names/checksums |
| Runtime/deployment | Fastify API service wired into same-origin gateway, root commands, Dockerfile, and Compose overlays | After all cutovers, standard Next.js web plus independent API/worker artifacts and gateway |

## Architecture batch dependency order

Follow [ADR-0001](decisions/0001-api-runtime-and-hosting.md) and the [route inventory](route-inventory.json).

| Order | Planned work identifier | Status | Deliverable |
| --- | --- | --- | --- |
| 1 | CR-ARCH-09 | **Merged** (PR #59, #49) | Fastify API workspace, bootstrap/lifecycle/container/gateway wiring; migrated `/api/live` with real direct and gateway contract tests; old Next handler removed |
| 2 | CR-ARCH-10A | **Merged** (PR #60, #50) | Auth adapters/shared middleware and identity/password contracts |
| 3 | CR-ARCH-14 | **Merged** (PR #61, #51) | Socket.IO moves from web to API, including worker transport and room/session ownership tests (Variant X; corrective PR #62) |
| 4 | CR-ARCH-10B | **Merged** (PR #63, #52) | User-management, admin password and bulk ingestion HTTP slice; verified across direct Fastify API and gateway cutover |
| 5 | CR-ARCH-11A | **Merged** (PR #64, #53) | Course/department/mapping HTTP slices; coordinate shared-file edits |
| 6 | CR-ARCH-11B | **Merged** (PR #65, #54) | Practical management and reporting HTTP slice; preserve realtime publication and reporting snapshot integrity |
| 7 | CR-ARCH-12A | **Merged** (PR #66, #55) | Execution intake, language aliases and job status HTTP slice; verified across direct Fastify API and gateway cutover |
| 8 | CR-ARCH-12B | **Merged** (PR #67, #56) | Submission/history/reset/workspace HTTP slice; verified across direct Fastify API and gateway cutover |
| 9 | CR-ARCH-13 | **Merged** (PR #68, #57) | Operations/profile remaining HTTP slice; preserve readiness without running migrations |
| 10 | CR-ARCH-15 | **Merged** (PR #69, #58) | Complete web/API separation; remove web backend imports/secrets/custom Socket.IO server only now |

## Completion evidence for CR-ARCH-09 (3A)

- **PR**: Targets master with `Closes #49`.
- **Fastify API Workspace**: Created `@coderank/api` in `apps/api` with Fastify v5, `app.js` (factory), `server.js` (lifecycle/signals/listen), `config/env.js` (port/host precedence).
- **Authoritative Liveness Route**: `GET /api/live` implemented in `apps/api/src/modules/operations/operations.routes.js` with HTTP 200, `{ status: 'ok', timestamp: <ISO> }`, and `Cache-Control: no-store`. Unsupported methods (`POST`, `PUT`, `DELETE`, `PATCH`) return HTTP 405 Method Not Allowed with `Allow: GET, HEAD` and `Cache-Control: no-store`.
- **Cutover**: Next.js handler `apps/web/src/app/api/live/route.js` removed; runtime gateway in `apps/web/server.js` and `src/lib/api-gateway.js` forwarding `/api/live` to `INTERNAL_API_URL` while preserving unmigrated routes on web.
- **Compose and Deployment**: `apps/api/Dockerfile` created (no runner/Docker socket); `infrastructure/docker-compose.yml` and `infrastructure/compose.containers.yaml` wired with `api` service.
- **Verification**: Real listening direct API and gateway contract tests in `tests/api-live-runtime.test.mjs`, full architecture boundary tests in `tests/architecture.test.mjs`, unit tests (`npm test`), critical lint (`npm run lint:critical`), and build checks pass cleanly.

### CR-ARCH-10A ownership and verification
Login and authenticated profile loading move to the API auth service, with API middleware authenticating before protected JSON parsing. Shared self-account mutations remain in core temporarily because the unmigrated admin-password and username-profile adapters still consume them; 3D/3I must retire that compatibility usage. The API closes its Redis and database resources after HTTP drain. Real direct/gateway contracts cover auth errors, session rotation, expiry, database role authority, profile/password changes, deactivation and Redis throttling/outage, including clean shutdown. See PR #60 for final tested SHA and CI evidence.

### CR-ARCH-14 ownership and verification
Socket.IO server creation, authentication middleware, room authorization, periodic session revalidation, and worker/service realtime publisher moved from Next.js custom server (apps/web/server.js) into Fastify API runtime (apps/api/src/realtime/). Next.js server now exclusively forwards WebSocket upgrade requests via same-origin gateway (proxyApi.upgrade). Removed obsolete server realtime files (apps/web/src/lib/realtime.js, realtime-session.js, realtime-adapter.js) and removed socket.io and @socket.io/redis-adapter dependencies from apps/web. Updated worker, stack smoke tests, and Docker compose configurations to point REALTIME_URL to the API server at http://api:3001. Verified with direct API Socket.IO and gateway upgrade proxy contracts in tests/api-realtime-runtime.test.mjs, unit tests, lint, and full build.

### Realtime review correction
The review of PR #61 removes forced-success test cleanup, exposes the API-local publisher through a declared Fastify plugin, closes WebSockets before HTTP drain without private server mutation, waits for in-flight socket authorization and closes the lazily allocated job-status queue, and scopes replica shutdown to local sockets. API container configuration includes the database, Redis adapter and allowed browser origin. Host launchers derive worker transport from API_PORT. Strict authenticated verification starts two real API processes and checks gateway/cross-replica fan-out, job ownership, hidden-output privacy, expiry/revocation and isolated replica drain. No SQL migration or grading/queue-admission contract changes are required.

### CR-ARCH-10B ownership and verification
User management, bulk upload/create, and administrative password modification endpoints migrated to the Fastify API runtime (`apps/api/src/modules/users/`). Handlers removed from Next.js (`apps/web/src/app/api/admin/bulk-upload/route.js`, `apps/web/src/app/api/admin/password/route.js`, `apps/web/src/app/api/users/route.js`, `apps/web/src/app/api/users/[id]/route.js`, `apps/web/src/app/api/users/bulk/route.js`). Streaming multipart upload parsing registered in Fastify via `@fastify/multipart` with 5MB limits; CSV and Excel parsing dependencies declared directly in `apps/api/package.json` (`csv-parse`, `exceljs`) and unneeded entries removed from `apps/web/package.json`. Keyset cursor pagination (`X-Next-Cursor`), `Cache-Control: no-store`, `Server-Timing`, administrator authorization checks, batch transactions, and HTTP 405 Method Not Allowed handling with `Allow` headers are verified. Direct API and gateway cutover tested via `tests/api-users-runtime.test.mjs`, `tests/bulk-users-api.test.mjs`, `tests/api-input-contracts.test.mjs`, `tests/architecture.test.mjs`, `npm test` (all 291 unit tests passing), `npm run lint:critical`, and turbo build.

### CR-ARCH-11A ownership and verification
Courses, departments, and faculty mapping APIs extracted to Fastify API runtime (`apps/api/src/modules/courses/` and `apps/api/src/modules/mapping/`).
- **Exact endpoint ownership**:
  - `GET /api/courses`: list courses with optional search, semester filter, cursor pagination, and `X-Next-Cursor` header.
  - `POST /api/courses`: atomic course creation by administrator via `coderank_manage_catalog`.
  - `PUT /api/courses/:id`: atomic course update by administrator.
  - `DELETE /api/courses/:id`: atomic course deletion with practical history preservation check.
  - `GET /api/departments`: list departments with search and cursor pagination.
  - `POST /api/departments`: atomic department creation by administrator.
  - `PUT /api/departments/:id`: atomic department update by administrator.
  - `DELETE /api/departments/:id`: atomic department deletion with active user assignment check.
  - `GET /api/mapping`: faculty-to-course mapping retrieval grouped by course ID.
  - `POST /api/mapping`: atomic faculty mapping assignment via `coderank_replace_mapping`.
- **Gateway Cutover**:
  - Next.js handlers removed from `apps/web/src/app/api/courses/`, `departments/`, and `mapping/`.
  - Same-origin gateway in `apps/web/src/lib/api-gateway.js` routes all courses, departments, and mapping requests directly to `INTERNAL_API_URL`.
- **Backward Compatibility**:
  - Retained faculty read queries (`getFacultyCourses`, `getBatches`) in `packages/core/src/modules/courses/CourseService.js` for upcoming CR-ARCH-11B (3F).
  - Maintained single shared pagination helper in `packages/core/src/modules/courses/list-pagination.js` exported as `@coderank/core/pagination`.
- **Verification**:
  - Direct API and gateway runtime contracts in `tests/api-courses-runtime.test.mjs`.
  - Unit and boundary checks in `tests/architecture.test.mjs`, `tests/admin-api.test.mjs`, `tests/api-input-contracts.test.mjs`, and `tests/api-live-runtime.test.mjs`.
  - Stack contract verification in `scripts/lib/courses-contracts.mjs` and `scripts/authenticated-stack.mjs`.

### CR-ARCH-11B ownership and verification
Practical management, extra time extension, practical stats, and course marks reporting APIs extracted to Fastify API runtime (`apps/api/src/modules/practicals/`).
- **Exact endpoint ownership (9 endpoints)**:
  - `GET /api/faculty/batches`: returns list of distinct active student batches with `X-Next-Cursor` header.
  - `GET /api/faculty/courses`: returns assigned courses for faculty or all courses for admin, with `X-Next-Cursor` header.
  - `GET /api/faculty/courses/[id]/stats`: course marks report matrix and student score breakdown.
  - `GET /api/faculty/practicals`: lists practicals for faculty with pagination cursor.
  - `POST /api/faculty/practicals`: creates practical assignment via `coderank_mutate_practical` and emits `practical_added` to `course_${courseId}` room via `fastify.publisher.publishPracticalChange`.
  - `GET /api/faculty/practicals/[id]`: returns detail with ordered test cases for authorized faculty.
  - `PUT /api/faculty/practicals/[id]`: updates practical assignment and test cases, emits `practical_updated` via `fastify.publisher.publishPracticalChange`.
  - `DELETE /api/faculty/practicals/[id]`: archives practical (`status='inactive'`) preserving grading history and attempts, emits `practical_deleted` via `fastify.publisher.publishPracticalChange`.
  - `POST /api/faculty/practicals/[id]/extra-time`: grants deadline extension, emits `practical_updated` via `fastify.publisher.publishPracticalChange`.
  - `GET /api/faculty/practicals/[id]/stats`: practical-level score distributions and submission statistics.
  - `GET /api/student/practicals`: lists accessible active practicals matching student cohort and semester.
  - `GET /api/student/practicals/[id]`: returns sanitized student practical details without hidden test cases.
- **Gateway Cutover**:
  - Removed old handlers: `apps/web/src/app/api/faculty/batches/route.js`, `apps/web/src/app/api/faculty/courses/route.js`, `apps/web/src/app/api/faculty/courses/[id]/stats/route.js`, `apps/web/src/app/api/faculty/practicals/route.js`, `apps/web/src/app/api/faculty/practicals/[id]/route.js`, `apps/web/src/app/api/faculty/practicals/[id]/extra-time/route.js`, `apps/web/src/app/api/faculty/practicals/[id]/stats/route.js`, `apps/web/src/app/api/student/practicals/route.js`, and `apps/web/src/app/api/student/practicals/[id]/route.js`.
  - Gateway (`apps/web/src/lib/api-gateway.js`) explicitly routes all 9 practical management and reporting endpoints to `INTERNAL_API_URL`.
  - Unmigrated submission and workspace endpoints (`/api/faculty/practicals/[id]/submissions`, `/api/faculty/submissions/[id]`, `/api/student/practicals/[id]/submit`, `/api/student/practicals/[id]/submissions`, `/api/student/submissions`, `/api/student/workspaces/*`) remain unproxied on Next.js for slice 3H.
- **Verification**:
  - Direct Fastify API contracts, realtime event emission, 401/403/404/405/OPTIONS handling, and gateway selective routing in `tests/api-practicals-runtime.test.mjs`.
  - Architecture boundaries and route inventory alignment in `tests/architecture.test.mjs`.
  - Unit test lane (`npm test`, 304 passing), linting (`npm run lint:critical`), and build checks (`@coderank/api` and `@coderank/web`) pass cleanly.

### CR-ARCH-12A ownership and verification
Execution intake, language aliases, and job status polling endpoints migrated to the Fastify API runtime (`apps/api/src/modules/execution/`).
- **Exact endpoint ownership (9 endpoints)**:
  - `POST /api/c-run`: Dedicated C language execution alias.
  - `POST /api/cpp-run`: Dedicated C++ language execution alias.
  - `POST /api/java-run`: Dedicated Java language execution alias.
  - `POST /api/javascript-run`: Dedicated JavaScript language execution alias.
  - `POST /api/python-run`: Dedicated Python language execution alias.
  - `POST /api/run`: Generic execution intake endpoint with problem and language detection.
  - `GET /api/practice-run`: Practice queue status and connectivity inspection.
  - `POST /api/practice-run`: Playground execution intake with Python default.
  - `GET /api/execute`: Queue connectivity and supported language capability inspection.
  - `POST /api/execute`: Unified playground execution intake.
  - `GET /api/jobs/[jobId]`: Job status polling and sanitized completed result retrieval.
- **Relocation of Static Problem Content**:
  - Deliberately relocated `STATIC_PROBLEMS` to `packages/core/src/modules/practice/problems.js` and exported via `@coderank/core/practice/problems`.
  - Re-exported `STATIC_PROBLEMS` from `apps/web/src/features/practice/problems.js` ensuring full environment safety across API and Web without cyclic dependencies.
- **Gateway Cutover**:
  - Removed old handlers: `apps/web/src/app/api/c-run/route.js`, `apps/web/src/app/api/cpp-run/route.js`, `apps/web/src/app/api/java-run/route.js`, `apps/web/src/app/api/javascript-run/route.js`, `apps/web/src/app/api/python-run/route.js`, `apps/web/src/app/api/run/route.js`, `apps/web/src/app/api/practice-run/route.js`, `apps/web/src/app/api/execute/route.js`, and `apps/web/src/app/api/jobs/[jobId]/route.js`.
  - Same-origin gateway (`apps/web/src/lib/api-gateway.js`) configured to route all 9 endpoints and dynamic `/api/jobs/*` paths to `INTERNAL_API_URL`.
  - Unmigrated practical submission and workspace endpoints remain on Next.js for slice 3H.
- **Verification**:
  - Direct Fastify API contracts, guest session cookies (`coderank_execution_session`), job ownership authorization, hidden test case output sanitization, rate limits (429), queue saturation (503 with Retry-After: 5), validation errors (400, 413, 404), and 405 Method Not Allowed handling verified in `tests/api-execution-runtime.test.mjs`.
  - Architecture boundaries and route inventory validated in `tests/architecture.test.mjs` (13/13 passing).
  - All unit tests pass in `npm test` (312/312 passing).
  - Critical lint passes (`npm run lint:critical` with 0 warnings).
  - Turborepo build (`turbo run build`) succeeds cleanly for all workspaces.

### CR-ARCH-12B ownership and verification
Submissions, submission history, resets, and student workspace draft persistence migrated to the Fastify API runtime (`apps/api/src/modules/submissions/`).
- **Exact endpoint ownership (8 endpoints)**:
  - `POST /api/submit`: Practice and generic code submission handler (reusing 3G execution intake policy).
  - `POST /api/student/practicals/[id]/submit`: Graded submission dispatch for assigned practicals.
  - `GET /api/student/submissions`: Student global submission history with pagination (`X-Next-Cursor`).
  - `GET /api/student/practicals/[id]/submissions`: Practical-specific submission history.
  - `GET /api/faculty/practicals/[id]/submissions`: Faculty practical submissions review and audit.
  - `GET /api/faculty/submissions/[id]`: Faculty submission detail inspection with binary BYTEA code decoding.
  - `DELETE /api/faculty/submissions/[id]`: Faculty submission reset and deletion via `coderank_reset_submission`.
  - `GET /api/student/workspaces/load`: Student draft workspace loading.
  - `POST /api/student/workspaces/save`: Student draft workspace saving.
- **Service Layer in `apps/api/src/modules/submissions/submissions.service.js`**:
  - `SubmissionsService` wraps and coordinates core domain services (`SubmissionHistoryService`, `SubmissionService`, `ExecutionService`).
  - Implements `decodeBinaryCode` for BYTEA / Buffer / Hex / base64 code payloads.
- **Retirement of Legacy Adapters**:
  - Removed old handlers:
    - `apps/web/src/app/api/submit/route.js`
    - `apps/web/src/app/api/student/practicals/[id]/submit/route.js`
    - `apps/web/src/app/api/student/submissions/route.js`
    - `apps/web/src/app/api/student/practicals/[id]/submissions/route.js`
    - `apps/web/src/app/api/faculty/practicals/[id]/submissions/route.js`
    - `apps/web/src/app/api/faculty/submissions/[id]/route.js`
    - `apps/web/src/app/api/student/workspaces/load/route.js`
    - `apps/web/src/app/api/student/workspaces/save/route.js`
  - Retired `apps/web/src/lib/execution-api.js` and `apps/web/src/lib/binaryCode.js` as all consumers have now migrated to API.
- **Gateway Cutover**:
  - Same-origin gateway (`apps/web/src/lib/api-gateway.js`) configured to route `/api/submit`, `/api/student/submissions`, `/api/student/workspaces/*`, `/api/student/practicals/:id/submit`, `/api/student/practicals/:id/submissions`, `/api/faculty/practicals/:id/submissions`, and `/api/faculty/submissions/:id` to `INTERNAL_API_URL`.
- **Verification**:
  - Direct Fastify API and gateway cutover contracts verified in `tests/api-submissions-runtime.test.mjs` (30/30 assertions passing).
  - Architecture boundary rules and route inventory validated in `tests/architecture.test.mjs` (13/13 passing).
  - All 339 tests in unit test suite pass in `npm test`.
  - Critical lint passes (`npm run lint:critical` with 0 warnings).
  - Turborepo build (`turbo run build`) succeeds cleanly for all workspaces.

### CR-ARCH-13 ownership and verification
Operations, readiness, metrics, logs, queue statistics, admin stats, and username profile APIs extracted to Fastify API runtime (`apps/api/src/modules/operations/` and `apps/api/src/modules/profile/`).
- **Exact endpoint ownership (7 endpoints)**:
  - `GET /api/health`: Public readiness evaluation with PostgreSQL migration check (`checkDatabaseReadiness`), queue health, and execution worker status; in-memory caching with `X-Cache` (HIT/MISS/DISABLED), `Cache-Control: no-store`, status 200 (healthy) or 503 (degraded). Never runs migrations on startup or probe.
  - `GET /api/health/detailed`: Privileged administrative diagnostic probe with Node/process metrics, connection pools, circuit breakers, and execution queue counts; in-memory caching with `X-Cache` (HIT/STALE/MISS/DISABLED) and `Cache-Control: no-store`.
  - `GET /api/logs`: Administrator activity log audit stream with `limit` validation and keyset ordering; `Cache-Control: no-store`.
  - `GET /api/metrics`: Administrator operational metrics telemetry exposing request counters, error rates, p50/p90/p95 latency distributions, CPU/memory/event-loop delays, and endpoint breakdowns; `Cache-Control: no-store`.
  - `GET /api/queue/stats`: Public execution queue stats with in-memory caching, serving stale on revalidation with `X-Cache` (HIT/STALE/MISS) and `Cache-Control: public, s-maxage=5, stale-while-revalidate=10`.
  - `GET /api/stats`: Administrator system counters (faculty, student, course aggregates); `Cache-Control: no-store`.
  - `GET /api/profile/[username]`: Authenticated profile lookup returning student information and practical submission history; sanitizes user passwords and removes submission source code and hidden test case results.
  - `PUT /api/profile/[username]`: Authenticated student account and biography update; validates JSON object payload and preserves account security.
- **Service Layer in `apps/api/src/modules/operations/operations.service.js` & `profile.service.js`**:
  - `OperationsService` coordinates database schema readiness via `@coderank/database/readiness`, execution queue via `SubmissionService`, HTTP metrics via `node:perf_hooks`, and system reports via `CoreOperationsService`.
  - `ProfileService` wraps `UserService` for student profile lookup and updates.
- **Gateway Cutover**:
  - Removed old handlers:
    - `apps/web/src/app/api/health/route.js`
    - `apps/web/src/app/api/health/detailed/route.js`
    - `apps/web/src/app/api/logs/route.js`
    - `apps/web/src/app/api/metrics/route.js`
    - `apps/web/src/app/api/queue/stats/route.js`
    - `apps/web/src/app/api/stats/route.js`
    - `apps/web/src/app/api/profile/[username]/route.js`
  - All API routes in `apps/web/src/app/api` have now been migrated.
  - Same-origin gateway (`apps/web/src/lib/api-gateway.js`) configured to route all operations and `/api/profile/*` requests to `INTERNAL_API_URL`.
- **Liveness vs Readiness vs Deployment Readiness**:
  - **Liveness (`/api/live`)**: Zero-dependency probe returning immediate 200 `{ status: 'ok', timestamp }` to verify process responsiveness.
  - **Readiness (`/api/health`)**: Runtime probe evaluating operational dependencies (PostgreSQL schema readiness, Redis queue, execution workers) with 10s caching; returns 200 when ready, 503 when degraded. Never runs migrations.
  - **Deployment Readiness (`deployment:check` / migration ledger)**: Deployment verification command checking migration ledger compliance before cutover.
- **Verification**:
  - Direct Fastify API and gateway cutover contracts verified in `tests/api-operations-runtime.test.mjs` (12/12 assertions passing).
  - Health failure and degradation verified in `tests/health.test.mjs`.
  - Profile privacy and sanitization verified in `tests/profile-privacy.test.mjs`.
  - Architecture boundary rules and route inventory validated in `tests/architecture.test.mjs` (13/13 passing).
  - All unit tests pass in `npm test`.
  - Critical lint passes (`npm run lint:critical` with 0 warnings).
  - Turborepo build (`turbo run build`) succeeds cleanly for all workspaces.

PR #68 review correction: operations SQL and username profile reads now belong to API. Self-account mutation shared by auth, users and profile is implemented once in API auth/account.service.js; retired core methods/operations export are removed. Metrics record all registered API routes with bounded labels, without username/query leakage. Real PostgreSQL/Redis acceptance checks direct/gateway admin permissions, profile privacy/identity, database/Redis-unavailable readiness and an unchanged migration ledger. Final CI evidence is recorded on the PR.

## CR-ARCH-15 (#58) separation evidence

**Merged** in PR #69. The web custom server/cluster and server-only compatibility helpers are removed. Standard Next.js and standalone packaging are independently tested without backend modules/services/secrets; API is independently tested without Next.js/React/runner. The infrastructure gateway routes all API paths exactly once and upgrades Socket.IO; host supervision retains frontend replica replacement and drain. All application images also run together against disposable Compose PostgreSQL/Redis, controlled migrations and real worker/Docker execution. Certification requires container-topology evidence in addition to all existing browser, security, capacity and recovery gates. Vercel configs are retired under ADR-0001; cloud hosting remains separate. Broad frontend decomposition, remaining core feature/facade cleanup, database assets, sandbox/warm mode and test/script organization remain later work.

Vercel Git retirement: root `vercel.json` contains only the schema and `git.deploymentEnabled: false`. It disables obsolete automatic Git deployments; it contains no build/output/routes and does not claim cloud support. The competing infrastructure config is removed. Existing hosted deployments are not deleted; a supported cloud topology needs its own reviewed cutover.

## Position 4A: API-only service ownership correction and reconciliation (#70)

### Audit and corrective scope
All ten runtime migration issues (#49–#58) were closed and their PRs merged, achieving standard Next web, Fastify API and independent worker runtimes. However, earlier route extractions had left API-only feature business logic in `packages/core` behind delegating API wrappers. Position 4A resolves these confirmed omissions:
1. User CRUD & Administration: `UserManagementService` (mutate, admin validation) and API-only user features (`listUsers`, `bulkCreateUsers`, `bulkUploadUsers`) relocated to `apps/api/src/modules/users/`.
2. Faculty Practical CRUD: `PracticalManagementService` moved to `apps/api/src/modules/practicals/practical-management.service.js`; shared identifier validation primitive (`positiveId`) extracted to `@coderank/core/shared/identifiers`.
3. Practical & Course Reporting: `PracticalReportService` and `CourseReportService` moved to `apps/api/src/modules/practicals/`.
4. Student Practical Discovery: `StudentPracticalService` moved to `apps/api/src/modules/practicals/student-practical.service.js`.
5. Submission History & Reset: `SubmissionHistoryService` moved to `apps/api/src/modules/submissions/submission-history.service.js`. Reset orchestration (`deleteSubmission`) and student workspace draft persistence (`saveWorkspace`, `loadWorkspace`) moved from core `SubmissionService` directly to `apps/api/src/modules/submissions/submissions.service.js`.

### Method-to-Owner reconciliation

| Domain & Feature | Method / Responsibility | Final Owning Module | Runtime Scope |
| --- | --- | --- | --- |
| User Admin | `mutate`, `createUser`, `updateUser`, `deleteUser` | `apps/api/src/modules/users/user-management.service.js` | API-only (HTTP) |
| User Discovery | `listUsers`, `validateDivision` | `apps/api/src/modules/users/user-management.service.js` & `users.service.js` | API-only (HTTP) |
| Bulk Users | `bulkUploadUsers`, `bulkCreateUsers` | `apps/api/src/modules/users/users.service.js` | API-only (HTTP) |
| Practical CRUD | `list`, `mutate`, `detail`, `faculty` | `apps/api/src/modules/practicals/practical-management.service.js` | API-only (HTTP) |
| Practical Discovery | `StudentPracticalService.list`, `detail` | `apps/api/src/modules/practicals/student-practical.service.js` | API-only (HTTP) |
| Practical Reports | `PracticalReportService.stats` | `apps/api/src/modules/practicals/practical-report.service.js` | API-only (HTTP) |
| Course Reports | `CourseReportService.marks` | `apps/api/src/modules/practicals/course-report.service.js` | API-only (HTTP) |
| Submission History | `SubmissionHistoryService.student`, `faculty` | `apps/api/src/modules/submissions/submission-history.service.js` | API-only (HTTP) |
| Reset Orchestration | `deleteSubmission` (`coderank_reset_submission`) | `apps/api/src/modules/submissions/submissions.service.js` | API-only (HTTP) |
| Workspace Drafts | `saveWorkspace`, `loadWorkspace` | `apps/api/src/modules/submissions/submissions.service.js` | API-only (HTTP) |
| Practical Policy | `PracticalService.authorize` | `packages/core/src/modules/practicals/PracticalService.js` | Shared (API & Worker) |
| Queue & Status | `enqueueJob`, `getJobStatus`, `getQueueStats`, `getWorkerStatus` | `packages/core/src/modules/submissions/SubmissionService.js` | Shared (API & Worker) |
| Submission Persist | `getSubmission` (details + test cases) | `packages/core/src/modules/submissions/SubmissionService.js` | Shared (API & Worker) |
| Grading Policy | `GradingService.gradePractical` | `packages/core/src/modules/submissions/GradingService.js` | Shared (Worker) |
| Identifiers | `positiveId` | `packages/core/src/shared/identifiers.js` | Shared Primitive |
| Pagination | `listPage` | `packages/core/src/shared/pagination.js` | Shared Primitive |

### Boundary Enforcement
`tests/final-separation.test.mjs` explicitly asserts that the six API-only modules (`UserManagementService`, `PracticalManagementService`, `StudentPracticalService`, `CourseReportService`, `PracticalReportService`, `SubmissionHistoryService`) do not exist in `packages/core`, and that their replacement services are present in `apps/api`.
