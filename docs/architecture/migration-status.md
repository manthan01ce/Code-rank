# Architecture migration status

Reviewed against master `a8425a352cc355c12906c8af93a517f136d610ec` and branch `refactor/cr-arch-11b-3f` (CR-ARCH-11B / Issue 3F / #54).

## Current versus destination

| Area | Current implementation | Recommendation and remaining work |
| --- | --- | --- |
| Applications | `apps/web`, `apps/worker`, `apps/api` | Fastify API workspace created; three application workspaces; complete separation remains scheduled for 3J |
| HTTP | `/api/live`, auth, users, courses, departments, mapping, and practicals endpoints migrated to `apps/api`; 29 route files remain in `apps/web/src/app/api` | Continue moving feature adapters and API-only services into `apps/api/src/modules` per batch schedule (3G: execution, 3H: submissions/workspaces, etc.); preserve URLs, auth, headers and responses |
| Realtime | Fastify API owns authoritative Socket.IO; Next.js server proxies `/socket.io` WebSocket upgrades; API publisher broadcasts practical/job changes | Web Socket.IO server completely eliminated; browser hooks and transitional publishers point to API |
| Frontend features | Coding-workspace, practice, credential PDF and practical-authoring extractions landed | Finish submission/reports/user workflows as separate slices; route files assemble views |
| Core | Browser PDF implementation removed; explicit runtime environment export added | Retain only genuinely shared backend rules; move API-only services, retire facades after consumers migrate |
| Tooling | Root tooling includes explicit lint dependencies, backend correctness rules, and covers `apps/api` | Continue expanding checks as each module migrates |
| Database | SQL assets and lifecycle scripts still under root `database/` | Consolidate under database package without changing migration names/checksums |
| Runtime/deployment | Fastify API service wired into same-origin gateway, root commands, Dockerfile, and Compose overlays | After all cutovers, standard Next.js web plus independent API/worker artifacts and gateway |

## Next dependency order

Follow [ADR-0001](decisions/0001-api-runtime-and-hosting.md) and the [route inventory](route-inventory.json).

| Order | Planned work identifier | Status | Deliverable |
| --- | --- | --- | --- |
| 1 | CR-ARCH-09 | **Merged** (PR #59) | Fastify API workspace, bootstrap/lifecycle/container/gateway wiring; migrated `/api/live` with real direct and gateway contract tests; old Next handler removed |
| 2 | CR-ARCH-10A | Implementation in PR #60 (3B / #50); verification recorded in PR | Auth adapters/shared middleware and identity/password contracts |
| 3 | CR-ARCH-14 | Merged in PR #61; lifecycle/deployment correction verified separately | Socket.IO moves from web to API, including worker transport and room/session ownership tests (Variant X) |
| 4 | CR-ARCH-10B | Merged in PR #63 (3D / #52) | User-management, admin password and bulk ingestion HTTP slice; verified across direct Fastify API and gateway cutover |
| 5 | CR-ARCH-11A | Merged in PR #64 (3E / #53) | Course/department/mapping HTTP slices; coordinate shared-file edits |
| 6 | CR-ARCH-11B | Merged in PR #65 (3F / #54) | Practical management and reporting HTTP slice; preserve realtime publication and reporting snapshot integrity |
| 7 | CR-ARCH-12A | Merged in PR #66 (3G / #55) | Execution intake, language aliases and job status HTTP slice; verified across direct Fastify API and gateway cutover |
| 8 | CR-ARCH-12B | Implementation in PR (3H / #56) | Submission/history/reset/workspace HTTP slice; verified across direct Fastify API and gateway cutover |
| 9 | CR-ARCH-13 | Blocked on 10B + 12B (3I / #57) | Operations/profile remaining HTTP slice; preserve readiness without running migrations |
| 10 | CR-ARCH-15 | Every slice complete (3J / #58) | Complete web/API separation; remove web backend imports/secrets/custom Socket.IO server only now |

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
