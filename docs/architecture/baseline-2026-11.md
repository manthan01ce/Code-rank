# CodeRank Architecture Baseline (November 2026)

## 1. Pre-Flight Environment & System Metadata

| Parameter | Recorded Value |
|---|---|
| **Repository** | `manthan01ce/Code-rank` |
| **Baseline Git Commit SHA** | `e8cd0a5e7306befc8c441c249b0b50b524597dd9` |
| **Remote Default Branch** | `master` (`origin/master`) |
| **Working Dedicated Branch** | `refactor/cr-arch-01a-record-baseline` |
| **Operating System** | Windows (PowerShell shell environment) |
| **Node.js Runtime** | `v24.14.1` (declared requirement: `engines.node: ">=24.0.0"`) |
| **Package Manager** | `npm@11.11.0` (declared: `packageManager: "npm@11.11.0"`) |
| **Working Tree State** | Clean checkout; verified prior to execution |
| **Target Baseline Date** | 3 November 2026 |

---

## 2. Inventory Summary: Pages & API Routes

The inventory records 19 page files and 47 API route files, their declared methods and migration owners. Response/status/auth metadata is source-observed guidance, not exhaustive runtime characterization. The architecture test discovers files and uses a regular expression for exported methods; AST parsing is used separately for syntax and dependency checks.

### 2.1 Web Pages (19 Total)

All 19 framework page routes are accounted for:

| Page URL | Source File | Feature Owner / Scope | Purpose & Description |
|---|---|---|---|
| `/` | `apps/web/src/app/page.js` | `out-of-scope` | Public marketing landing page & feature overview |
| `/admin` | `apps/web/src/app/admin/page.js` | `CR-ARCH-13` | Administrator dashboard & system summary |
| `/admin/courses` | `apps/web/src/app/admin/courses/page.js` | `CR-ARCH-11A` | Admin course catalog management UI |
| `/admin/departments` | `apps/web/src/app/admin/departments/page.js` | `CR-ARCH-11A` | Admin academic department catalog UI |
| `/admin/faculty` | `apps/web/src/app/admin/faculty/page.js` | `CR-ARCH-10B` | Admin faculty user CRUD & CSV upload UI |
| `/admin/logs` | `apps/web/src/app/admin/logs/page.js` | `CR-ARCH-13` | System audit log viewer UI |
| `/admin/mapping` | `apps/web/src/app/admin/mapping/page.js` | `CR-ARCH-11A` | Faculty-to-course mapping interface |
| `/admin/profile` | `apps/web/src/app/admin/profile/page.js` | `CR-ARCH-10A` | Admin user profile and identity management |
| `/admin/settings` | `apps/web/src/app/admin/settings/page.js` | `CR-ARCH-10B` | Administrative system configuration |
| `/admin/students` | `apps/web/src/app/admin/students/page.js` | `CR-ARCH-10B` | Admin student user CRUD & bulk import UI |
| `/code` | `apps/web/src/app/code/page.js` | `CR-ARCH-12A` | Standalone coding playground & execution UI |
| `/faculty` | `apps/web/src/app/faculty/page.js` | `CR-ARCH-11B` | Faculty practical lab management portal |
| `/login` | `apps/web/src/app/login/page.js` | `CR-ARCH-10A` | User authentication login page |
| `/practice` | `apps/web/src/app/practice/page.js` | `CR-ARCH-12A` | Practice problem coding & test execution UI |
| `/profile/[username]` | `apps/web/src/app/profile/[username]/page.js` | `CR-ARCH-13` | Public student portfolio & profile page |
| `/signup` | `apps/web/src/app/signup/page.tsx` | `CR-ARCH-10A` | User self-registration / signup page |
| `/student` | `apps/web/src/app/student/page.js` | `CR-ARCH-11B` | Student dashboard & lab progress overview |
| `/student/code/[id]` | `apps/web/src/app/student/code/[id]/page.js` | `CR-ARCH-12B` | Practical coding workspace & submission UI |
| `/student/practicals` | `apps/web/src/app/student/practicals/page.js` | `CR-ARCH-11B` | Student practical assignments catalog UI |

---

### 2.2 API Route Allocations (47 Total)

Each of the 47 API routes is assigned to exactly one migration package identifier, without overlap or omission:

| Migration Identifier | Scope Description | Route Count |
|---|---|---|
| **CR-ARCH-09** | Representative low-risk route for extraction baseline | **1** |
| **CR-ARCH-10A** | Login, password & identity/authentication endpoints, shared HTTP middleware | **3** |
| **CR-ARCH-10B** | User CRUD, bulk upload & admin password management endpoints | **5** |
| **CR-ARCH-11A** | Courses, departments & faculty-course mapping | **5** |
| **CR-ARCH-11B** | Faculty/student practical management & associated reporting endpoints | **9** |
| **CR-ARCH-12A** | Run/c-run/language aliases, practice execution & job status | **9** |
| **CR-ARCH-12B** | Submit, submission history/reset & submission workspace endpoints | **8** |
| **CR-ARCH-13** | Health/live/metrics/stats/logs/queue statistics & public username profile | **7** |
| **TOTAL** | | **47** |

#### Justification for CR-ARCH-09 Selection: `/api/live`
`/api/live` (`apps/web/src/app/api/live/route.js`) is selected as the representative pilot route for CR-ARCH-09. Its implementation is deliberately dependency-free: it requires zero database queries, zero Redis/BullMQ connections, no authentication cookies or tokens, and returns a static JSON timestamp. This makes it an ideal candidate to validate the isolated API server framework, port binding, test harnesses, and CI contracts in CR-ARCH-09 without coupling to unmigrated storage or auth services.

#### Detailed Route Mapping Table:

| API URL Path | Source File | Methods | Owner | Auth Mode | Parsing | Status Codes | Key Callers & Services |
|---|---|---|---|---|---|---|---|
| `/api/live` | `apps/web/src/app/api/live/route.js` | `GET` | **CR-ARCH-09** | None (public) | None | 200 | Liveness probe (no services) |
| `/api/auth/login` | `apps/web/src/app/api/auth/login/route.js` | `POST` | **CR-ARCH-10A** | None (public) | JSON | 200, 400, 401, 429, 500, 503 | `UserService.login`, `rateLimiter` |
| `/api/auth/change-password` | `apps/web/src/app/api/auth/change-password/route.js` | `POST` | **CR-ARCH-10A** | Bearer | JSON | 200, 400, 401, 500 | `UserService.changePassword`, `active-actor` |
| `/api/auth/profile` | `apps/web/src/app/api/auth/profile/route.js` | `GET`, `PUT` | **CR-ARCH-10A** | Bearer | JSON | 200, 400, 401, 500 | `UserService.updateProfile`, `active-actor` |
| `/api/admin/bulk-upload` | `apps/web/src/app/api/admin/bulk-upload/route.js` | `POST` | **CR-ARCH-10B** | Admin | FormData | 200, 400, 401, 500 | `UserService.bulkUploadUsers`, `exceljs` |
| `/api/admin/password` | `apps/web/src/app/api/admin/password/route.js` | `POST` | **CR-ARCH-10B** | Admin | JSON | 200, 400, 401, 500 | `UserService.changePassword`, `active-actor` |
| `/api/users` | `apps/web/src/app/api/users/route.js` | `DELETE`, `GET`, `POST`, `PUT` | **CR-ARCH-10B** | Admin | JSON, Query | 200, 400, 401, 500 | `UserService.getUsersKeyset`, `active-actor` |
| `/api/users/[id]` | `apps/web/src/app/api/users/[id]/route.js` | `DELETE`, `PUT` | **CR-ARCH-10B** | Admin | JSON, Params | 200, 400, 401, 404, 500 | `UserManagementService`, `active-actor` |
| `/api/users/bulk` | `apps/web/src/app/api/users/bulk/route.js` | `POST` | **CR-ARCH-10B** | Admin | FormData | 200, 400, 401, 500 | `UserManagementService.streamBulkUsers` |
| `/api/courses` | `apps/web/src/app/api/courses/route.js` | `GET`, `POST` | **CR-ARCH-11A** | Bearer/Admin | JSON, Query | 200, 400, 401, 500 | `CourseService`, `active-actor` |
| `/api/courses/[id]` | `apps/web/src/app/api/courses/[id]/route.js` | `DELETE`, `PUT` | **CR-ARCH-11A** | Admin | JSON, Params | 200, 400, 401, 404, 500 | `CourseService`, `active-actor` |
| `/api/departments` | `apps/web/src/app/api/departments/route.js` | `GET`, `POST` | **CR-ARCH-11A** | Bearer/Admin | JSON | 200, 400, 401, 500 | `CourseService`, `active-actor` |
| `/api/departments/[id]` | `apps/web/src/app/api/departments/[id]/route.js` | `DELETE`, `PUT` | **CR-ARCH-11A** | Admin | JSON, Params | 200, 400, 401, 404, 500 | `CourseService`, `active-actor` |
| `/api/mapping` | `apps/web/src/app/api/mapping/route.js` | `GET`, `POST` | **CR-ARCH-11A** | Admin | JSON, Query | 200, 400, 401, 500 | `MappingService`, `active-actor` |
| `/api/faculty/batches` | `apps/web/src/app/api/faculty/batches/route.js` | `GET` | **CR-ARCH-11B** | Faculty | None | 200, 401, 500 | `CourseService.getBatches`, `active-actor` |
| `/api/faculty/courses` | `apps/web/src/app/api/faculty/courses/route.js` | `GET` | **CR-ARCH-11B** | Faculty | None | 200, 401, 500 | `CourseService.getFacultyCourses` |
| `/api/faculty/courses/[id]/stats` | `apps/web/src/app/api/faculty/courses/[id]/stats/route.js` | `GET` | **CR-ARCH-11B** | Faculty | Params | 200, 401, 404, 500 | `CourseReportService`, `active-actor` |
| `/api/faculty/practicals` | `apps/web/src/app/api/faculty/practicals/route.js` | `GET`, `POST` | **CR-ARCH-11B** | Faculty | JSON, Query | 200, 201, 400, 401, 500 | `PracticalManagementService`, `practical-events` |
| `/api/faculty/practicals/[id]` | `apps/web/src/app/api/faculty/practicals/[id]/route.js` | `DELETE`, `GET`, `PUT` | **CR-ARCH-11B** | Faculty | JSON, Params | 200, 400, 401, 404, 500 | `PracticalManagementService`, `practical-events` |
| `/api/faculty/practicals/[id]/extra-time` | `apps/web/src/app/api/faculty/practicals/[id]/extra-time/route.js` | `POST` | **CR-ARCH-11B** | Faculty | JSON, Params | 200, 400, 401, 500 | `PracticalManagementService`, `active-actor` |
| `/api/faculty/practicals/[id]/stats` | `apps/web/src/app/api/faculty/practicals/[id]/stats/route.js` | `GET` | **CR-ARCH-11B** | Faculty | Params | 200, 401, 404, 500 | `PracticalReportService`, `active-actor` |
| `/api/student/practicals` | `apps/web/src/app/api/student/practicals/route.js` | `GET` | **CR-ARCH-11B** | Student | Query | 200, 401, 500 | `StudentPracticalService`, `active-actor` |
| `/api/student/practicals/[id]` | `apps/web/src/app/api/student/practicals/[id]/route.js` | `GET` | **CR-ARCH-11B** | Student | Params | 200, 401, 404, 500 | `StudentPracticalService`, `active-actor` |
| `/api/c-run` | `apps/web/src/app/api/c-run/route.js` | `POST` | **CR-ARCH-12A** | Optional / Guest | JSON | 202, 400, 429, 503 | `practiceHandler('c')`, `execution-api` |
| `/api/cpp-run` | `apps/web/src/app/api/cpp-run/route.js` | `POST` | **CR-ARCH-12A** | Optional / Guest | JSON | 202, 400, 429, 503 | `practiceHandler('cpp')`, `execution-api` |
| `/api/java-run` | `apps/web/src/app/api/java-run/route.js` | `POST` | **CR-ARCH-12A** | Optional / Guest | JSON | 202, 400, 429, 503 | `practiceHandler('java')`, `execution-api` |
| `/api/javascript-run` | `apps/web/src/app/api/javascript-run/route.js` | `POST` | **CR-ARCH-12A** | Optional / Guest | JSON | 202, 400, 429, 503 | `practiceHandler('javascript')`, `execution-api` |
| `/api/python-run` | `apps/web/src/app/api/python-run/route.js` | `POST` | **CR-ARCH-12A** | Optional / Guest | JSON | 202, 400, 429, 503 | `practiceHandler('python')`, `execution-api` |
| `/api/run` | `apps/web/src/app/api/run/route.js` | `POST` | **CR-ARCH-12A** | Optional / Guest | JSON | 202, 400, 429, 503 | `practiceHandler(null)`, `execution-api` |
| `/api/practice-run` | `apps/web/src/app/api/practice-run/route.js` | `GET`, `POST` | **CR-ARCH-12A** | Optional / Guest | JSON | 200, 202, 400, 429, 503 | `practiceHandler()`, `execution-api` |
| `/api/execute` | `apps/web/src/app/api/execute/route.js` | `GET`, `POST` | **CR-ARCH-12A** | Optional / Guest | JSON | 200, 202, 400, 429, 503 | `SubmissionService`, `execution-api` |
| `/api/jobs/[jobId]` | `apps/web/src/app/api/jobs/[jobId]/route.js` | `GET` | **CR-ARCH-12A** | Optional / Guest | Params | 200, 400, 401, 404, 500, 503 | `SubmissionService.getJobStatus` |
| `/api/submit` | `apps/web/src/app/api/submit/route.js` | `POST` | **CR-ARCH-12B** | Optional / Guest | JSON | 202, 400, 401, 429, 503 | `practiceHandler(null, true)`, `execution-api` |
| `/api/student/practicals/[id]/submit` | `apps/web/src/app/api/student/practicals/[id]/submit/route.js` | `POST` | **CR-ARCH-12B** | Student | JSON, Params | 202, 400, 401, 429, 503 | `enqueueExecution(submit=true)`, `execution-api` |
| `/api/student/submissions` | `apps/web/src/app/api/student/submissions/route.js` | `GET` | **CR-ARCH-12B** | Student | Query | 200, 400, 401, 500 | `SubmissionHistoryService.student` |
| `/api/student/practicals/[id]/submissions` | `apps/web/src/app/api/student/practicals/[id]/submissions/route.js` | `GET` | **CR-ARCH-12B** | Student | Query, Params | 200, 400, 401, 500 | `SubmissionHistoryService.student` |
| `/api/faculty/practicals/[id]/submissions` | `apps/web/src/app/api/faculty/practicals/[id]/submissions/route.js` | `GET` | **CR-ARCH-12B** | Faculty | Query, Params | 200, 400, 401, 404, 500 | `SubmissionHistoryService.faculty` |
| `/api/faculty/submissions/[id]` | `apps/web/src/app/api/faculty/submissions/[id]/route.js` | `DELETE`, `GET` | **CR-ARCH-12B** | Faculty | Params | 200, 401, 404, 500 | `SubmissionService.getSubmission`, `deleteSubmission` |
| `/api/student/workspaces/load` | `apps/web/src/app/api/student/workspaces/load/route.js` | `GET` | **CR-ARCH-12B** | Student | Query, Params | 200, 401, 500 | `SubmissionService.loadWorkspace` |
| `/api/student/workspaces/save` | `apps/web/src/app/api/student/workspaces/save/route.js` | `POST` | **CR-ARCH-12B** | Student | JSON | 200, 401, 500 | `SubmissionService.saveWorkspace` |
| `/api/health` | `apps/web/src/app/api/health/route.js` | `GET` | **CR-ARCH-13** | None (public) | None | 200, 500, 503 | `checkDatabaseReadiness`, `SubmissionService` |
| `/api/health/detailed` | `apps/web/src/app/api/health/detailed/route.js` | `GET` | **CR-ARCH-13** | Admin | None | 200, 401, 500, 503 | `OperationsService.getHealth`, `active-actor` |
| `/api/logs` | `apps/web/src/app/api/logs/route.js` | `GET` | **CR-ARCH-13** | Admin | Query | 200, 401, 500 | `OperationsService.getLogs`, `active-actor` |
| `/api/metrics` | `apps/web/src/app/api/metrics/route.js` | `GET` | **CR-ARCH-13** | Admin | None | 200, 401, 500 | `OperationsService.getMetrics`, `active-actor` |
| `/api/queue/stats` | `apps/web/src/app/api/queue/stats/route.js` | `GET` | **CR-ARCH-13** | None (public) | None | 200, 503 | `SubmissionService.getQueueStats` |
| `/api/stats` | `apps/web/src/app/api/stats/route.js` | `GET` | **CR-ARCH-13** | Admin | None | 200, 401, 500 | `OperationsService.getStats`, `active-actor` |
| `/api/profile/[username]` | `apps/web/src/app/api/profile/[username]/route.js` | `GET`, `PUT` | **CR-ARCH-13** | Bearer | JSON, Params | 200, 400, 401, 404, 500 | `UserService.getStudentProfileByUsername`, `updateProfile` |

---

## 3. Disambiguation Decisions & Boundaries

To resolve potential overlap across extraction batches, route ownership is disambiguated by role and business capability:

1. **Auth Identity (`CR-ARCH-10A`) vs Public Profile (`CR-ARCH-13`)**:
   - `/api/auth/profile` manages the authenticated caller's own identity and session data (`CR-ARCH-10A`).
   - `/api/profile/[username]` resolves public portfolio and profile information for a specific username (`CR-ARCH-13`).
2. **Account Password (`CR-ARCH-10A`) vs Admin Password Management (`CR-ARCH-10B`)**:
   - `/api/auth/change-password` is user self-service password modification requiring current credentials (`CR-ARCH-10A`).
   - `/api/admin/password` is administrative password modification for other user accounts (`CR-ARCH-10B`).
3. **Execution (`CR-ARCH-12A`) vs Submission Workspace (`CR-ARCH-12B`)**:
   - `/api/run`, `/api/practice-run`, `/api/*-run`, and `/api/jobs/[jobId]` handle ad-hoc test runs and code evaluation (`CR-ARCH-12A`).
   - `/api/student/workspaces/load` and `/api/student/workspaces/save` persist draft student workspace code across sessions (`CR-ARCH-12B`).
   - `/api/submit` and `/api/student/practicals/[id]/submit` enqueue official graded attempts (`CR-ARCH-12B`).
   - `/api/faculty/submissions/[id]` DELETE executes submission resets (`coderank_reset_submission`) (`CR-ARCH-12B`).

---

## 4. Architecture Test & Fixture Modernization

### 4.1 Schema Migration
The route inventory is now authored in `docs/architecture/route-inventory.json`.
The inventory defines:
- `baselineRevision`: commit SHA where verified (`e8cd0a5e7306befc8c441c249b0b50b524597dd9`)
- `generatedAt`: ISO timestamp
- `summary`: counts of pages, endpoints, and per-owner allocations
- `pages`: full list of framework pages with file, URL, owner, and description
- `endpoints`: full list of API endpoints with file, URL, HTTP methods, owner, auth, parsing, status codes, and services

### 4.2 Bi-Directional Discovered File Validation
`tests/architecture.test.mjs` was upgraded to:
1. Walk the physical filesystem (`apps/web/src/app`) to find all page and API route files.
2. Compare physical files against `docs/architecture/route-inventory.json` in **both directions**:
   - Fails if any source file is missing from the inventory.
   - Fails if any inventoried file does not exist in source.
3. Validate that every API endpoint is allocated to a valid owner (`CR-ARCH-09` through `CR-ARCH-13`).
4. Validate that CR-ARCH-09 has exactly one representative route.
5. Verify exported HTTP methods using source matching, while separate architecture checks use the TypeScript parser for syntax/dependency checks.
6. Verify synchronization with legacy fixture `tests/fixtures/routes.json` (which was updated to include all 19 pages and 47 routes) so existing consumers like `tests/api-route-contracts.test.mjs` pass without modifying read-only test files.

### 4.3 Negative Allocation Tests
Negative tests were added directly to `tests/architecture.test.mjs`:
- Rejection of unassigned endpoints (`owner: null`).
- Rejection of duplicate endpoint entries.
- Rejection of omitted endpoints.
- Rejection of invalid migration owner tags (e.g., `'CR-ARCH-99_INVALID'`).
- Rejection of duplicate CR-ARCH-09 endpoint allocation.
- Rejection of missing or extra page entries.

---

## 5. Workspaces, Internal Imports, Runtimes & Deployment Modes

### 5.1 Monorepo Workspaces
Declared in root `package.json`:
- **App workspaces (2)**: `apps/web`, `apps/worker`
- **Package workspaces (5)**: `packages/config`, `packages/core`, `packages/database`, `packages/queue`, `packages/runner`

### 5.2 Internal Path Imports
Current source files contain deep relative and non-exported paths that will require normalization in future package-boundary issues:
- `apps/web/cluster.js` -> `../../packages/core/src/config/env.js`
- `apps/web/next.config.mjs` -> `../../packages/core/src/config/env.js`
- `apps/web/server.js` -> `../../packages/core/src/config/env.js`
- `apps/worker/src/index.js` -> `../../../packages/core/src/config/env.js`
- Direct database client access from web adapters: `@coderank/core/db` imported in `apps/web/server.js`, `apps/web/src/lib/db.js`, `apps/web/src/app/api/health/route.js`.

### 5.3 Intended Test Files & Exclusions
- Unit test runner (`scripts/ci/run-tests.mjs unit`) discovers all files matching `tests/*.test.mjs` AND `tests/*.test.js`, with an explicit named quarantine list. At PR #37's reviewed source revision this is 60 `.test.mjs` files and one active `.test.js` file (61 unit test files); counts are source-snapshot facts, not fixed CI assertions.
- **Quarantined from unit lane (explicit, documented)**:
  - `tests/batch-execution.test.js`: its legacy Docker-command shim does not model the current Sandbox run/exec lifecycle. Quarantine is declared in `scripts/ci/run-tests.mjs` as `UNIT_QUARANTINE`; it is not selected by any current CI lane. CR-ARCH-24 must modernize the test, verify batch error/timeout/continuation behavior with real disposable Docker, register it in the docker lane and then remove quarantine. File relocation alone does not restore coverage.
- **Included in unit lane (`.test.js` extension)**:
  - `tests/job-lifecycle.test.js`: tests `waitForJob`, `boundedFetch`, `responseError` (from `apps/web/src/lib/job-lifecycle.js`) and `practicalPassed` (from `apps/worker/src/execution/runners/verdict.js`). No Docker or network dependencies; passes with 11 assertions. Uses ESM `import` syntax despite the `.js` extension; both extensions are deliberately supported.
- Integration tests (`tests/integration/*.test.mjs`): `queue`, `realtime`, `worker-readiness`, `worker-recovery`, `postgres`, `neon`.
- Docker isolation tests (`tests/integration/sandbox.test.mjs`).
- The `docs/development/test-inventory.md` document records the complete intended file inventory, suite routing, quarantine list and before/after change summary.

### 5.4 Docker & Compose Deployment Configurations
- **3 Compose Files**:
  1. `docker-compose.yml`: Top-level lab & full stack definition
  2. `infrastructure/docker-compose.yml`: Authoritative deployment Compose (PostgreSQL, Redis, base runner)
  3. `runner/docker-compose.yml`: Dedicated runner daemon configuration
- **7 Dockerfiles**:
  1. `apps/web/Dockerfile`: Production Next.js web application
  2. `apps/worker/Dockerfile`: Production BullMQ submission worker
  3. `infrastructure/docker/runner/Dockerfile`: `coderank-base:latest` execution image
  4. `runner/Dockerfile`: Standalone multi-compiler alpine image
  5. `infrastructure/docker/cpp/Dockerfile`: C/C++ isolated runner
  6. `infrastructure/docker/java/Dockerfile`: Java isolated runner
  7. `infrastructure/docker/python/Dockerfile`: Python isolated runner

### 5.5 Sandbox Execution Modes
- **Cold Container per Job**: Default execution allocates an ephemeral Docker container (`coderank-job-<uuid>`) with CPU/memory limits, dropped capabilities, and read-only root.
- **Warm Daemon Containers**: Enabled via `USE_WARM_DAEMONS=true` (`coderank-<language>-daemon`), reusing running containers for faster local interactive evaluation.

---

## 6. F-REALTIME Investigation & Architecture Findings

### 6.1 Source Audit Evidence
The source code contains mixed realtime communication patterns:

1. **In-Process Publisher (`global.io`)**:
   - `apps/web/server.js` sets `global.io = io`.
   - `apps/web/src/lib/practical-events.js` contains:
     ```javascript
     if (global.io) {
       global.io.to(`course_${practical.course_id}`).emit(`practical_${action}`, payload);
       return;
     }
     ```
   - In the monolithic deployment where web and API routes run inside `server.js`, events are dispatched entirely in-process.

2. **Cross-Process Socket.IO Client Fallback**:
   - If `global.io` is absent (such as in an isolated API process or command script), `practical-events.js` falls back to:
     ```javascript
     const socket = socketClient(process.env.REALTIME_URL || `http://127.0.0.1:${process.env.PORT || 3000}`, {
       transports: ['websocket'],
       auth: callback => callback({ serviceToken: createServiceToken() }),
       reconnection: false,
       timeout: 1000
     });
     socket.emit(`faculty_practical_${action}`, ...);
     const timer = setTimeout(() => socket.disconnect(), 1500);
     ```
   - This opens a transient socket connection authenticated via service token, emits the event to the websocket server, and disconnects after 1500ms.

3. **Worker Publisher (`apps/worker/src/workers/submission.worker.js`)**:
   - The worker runs as an independent process.
   - It connects persistently to `REALTIME_URL` via `socket.io-client` with a service token:
     ```javascript
     const socket = io(process.env.REALTIME_URL || `http://127.0.0.1:${process.env.PORT || 3000}`, {
       transports: ['websocket'],
       auth: callback => callback({ serviceToken: createServiceToken() })
     });
     ```
   - Upon job completion, it emits `worker_job_complete` and `worker_submission_saved` over Socket.IO.

4. **Websocket Server & Redis Distribution (`apps/web/server.js` & `apps/web/src/lib/realtime.js`)**:
   - `apps/web/server.js` mounts the Socket.IO server.
   - If `REALTIME_REDIS_ENABLED === 'true'`, it binds `@socket.io/redis-adapter` to publish/subscribe across nodes.
   - `attachRealtime` in `apps/web/src/lib/realtime.js` receives service events (`worker_job_complete`, `worker_submission_saved`, `faculty_practical_*`) and broadcasts them to room subscribers (`job_<id>`, `course_<id>`, `practical_<id>`).

> [!IMPORTANT]
> **Key Finding**: There is NO direct HTTP webhook publisher and NO direct Redis publisher from practical management routes. Realtime events are published either via in-process `global.io` or via authenticated Socket.IO client connections.

### 6.2 Evaluation of Dependency Rules: Variant X vs Variant Y

| Dimension | Variant X (In-Process Dependency Sequence) | Variant Y (Cross-Process Fallback Sequence) |
|---|---|---|
| **Core Concept** | Treat in-process `global.io` as the baseline reality. API extraction breaks in-process calls. | Treat the existing `socket.io-client` fallback in `practical-events.js` and worker as an existing cross-process path. |
| **Dependency Order** | 09 -> 10A -> **14 (Realtime/Socket.IO)** -> 11B, 12A, 12B | 09 -> 10A -> 10B -> 11A -> 11B -> 12A -> 12B -> 13 -> **14** |
| **Risks & Uncertainties** | Requires moving Issue 14 earlier in the migration roadmap. | Relies on per-event transient Socket.IO connection in `practical-events.js` without persistent pooling or reconnect guards. Requires loopback network reachability from API to Web. |
| **Prerequisite Tests** | Realtime contract tests handled in Issue 14. | Requires adding explicit cross-process publishing verification in Issue 09. |

### 6.3 Recommendation to Repository Owner
**Variant X is strongly recommended.** In-process `global.io` is currently the primary path in monolithic `apps/web`. The fallback in `practical-events.js` spawns a transient client connection per mutation with a hardcoded timeout, which is fragile under high concurrency and cross-container networking. Resolving realtime transport (Issue 14) before extracting practical and submission routes (11B/12A/12B) eliminates intermediate transport churn and race conditions.

---

## 7. Baseline Command Results

The original author recorded the following command output. `e8cd0a5e7306befc8c441c249b0b50b524597dd9` is the starting source revision, not a commit containing the inventory/test edits. Output explicitly labelled after migration reflects the working tree with those edits. The exact working-tree diff for each original local command was not recorded, so do not attribute all results to a clean unchanged baseline. These historical summaries are not fresh verification; use linked PR/CI results for commit-specific evidence.

### 1. `npm ci`
- **Exit Code**: `0`
- **Output Summary**:
  ```text
  added 611 packages, and audited 619 packages in 3m
  171 packages are looking for funding
  30 vulnerabilities (1 low, 25 moderate, 2 high, 2 critical)
  ```

### 2. `node --test tests/architecture.test.mjs`
- **Exit Code**: `0`
- **Output Summary (After Migration & Negative Tests)**:
  ```text
  ✔ all inventoried API paths and pages retain their HTTP methods, locations, and migration allocations (36.8ms)
  ✔ route inventory rejects unassigned, duplicate, or invalid endpoint allocations (negative validation) (15.2ms)
  ✔ domain and infrastructure dependencies obey one-way package boundaries (136.6ms)
  ✔ HTTP adapters delegate SQL and sandbox execution to packages (29.6ms)
  ✔ active JS/TS/TSX parses and local imports resolve (382.9ms)
  ✔ active lab launchers use the workspace and authoritative infrastructure (2.4ms)
  ✔ student coding page never serializes private practical content before bearer authentication (1.1ms)
  ℹ tests 7
  ℹ suites 0
  ℹ pass 7
  ℹ fail 0
  ℹ duration_ms 870.5ms
  ```

### 3. `npm run lint:critical`
- **Exit Code**: `0`
- **Output Summary**:
  ```text
  > coderank-monorepo@1.1.0 lint:critical
  > eslint --config apps/web/eslint.config.mjs packages/core packages/database packages/queue packages/runner apps/worker scripts apps/web/src/app/api apps/web/src/lib apps/web/server.js apps/web/cluster.js --max-warnings=0 load-tests/capacity.mjs apps/web/src/hooks/usePracticalPage.js apps/web/src/components/PracticalGradeReport.js "apps/web/src/app/student/code/**/WorkspaceClientWrapper.js"
  ```
  Completed with zero errors and zero warnings.

### 4. `npm test` (`node scripts/ci/run-tests.mjs unit`)
- **Exit Code**: `0`
- **Output Summary**:
  ```text
  TAP version 13
  1..203
  # tests 203
  # suites 0
  # pass 203
  # fail 0
  # duration_ms 34264.4541
  Strict unit test gate passed: 203 tests; artifact test-results/unit.tap
  ```
  *(Note: 203 tests passed, reflecting the addition of the negative allocation test).*

### 5. `npm run build --workspace=apps/web`
- **Exit Code**: `0`
- **Output Summary**:
  ```text
  ▲ Next.js 16.3.7 (Turbopack)
  ✓ Running next.config.mjs took 32ms
  Creating an optimized production build ...
  ✓ Compiled successfully in 8.5s
  Running TypeScript ...
  Finished TypeScript in 3.2s ...
  Generating static pages using 11 workers (48/48) in 1102ms
  Finalizing page optimization ...
  ```
  Prerendered 19 pages and built 47 dynamic API route handlers.

---

## 8. Verification Limits & Open Questions for Repository Owner

### 8.1 Verification Limits
1. **Live Container & Database Checks**: Commands requiring active background daemon infrastructure (`npm run test:integration`, `npm run test:docker`, `npm run test:stack`, `npm run test:redis`) require running PostgreSQL 16, Redis 7, and Docker daemon instances, which are verified in GitHub Actions CI (`.github/workflows/architecture-checks.yml`) rather than offline local development.
2. **Browser End-to-End Tests**: Playwright browser suite (`tests/browser`) requires Playwright browser binary installation and running web/worker processes.
3. **Excluded Legacy Tests**: `tests/batch-execution.test.js` and `tests/job-lifecycle.test.js` are not executed in standard unit test suites.

### 8.2 Questions for Repository Owner Review
1. **F-REALTIME Migration Sequencing**: Please confirm whether the architecture team accepts **Variant X** (scheduling Issue 14 Socket.IO migration before extracting practical/submission endpoints in 11B/12A/12B) or mandates **Variant Y** (relying on transient client fallback with new cross-process tests in 09).
2. **Disposition of `.test.js` Files**: Should `tests/batch-execution.test.js` and `tests/job-lifecycle.test.js` be modernized to ESM `.test.mjs` and added to `run-tests.mjs`, or archived into `docs/archive`?
3. **Primary Deployment Topology**: Confirm whether production deployment targets single-process `server.js` or multi-worker `cluster.js` with Redis adapter enabled, to ensure appropriate socket adapter assumptions during API separation.

## 9. Foundation corrections and owner decisions (3 November 2026)

The owner selected Fastify, a same-origin gateway, local lab Docker with local PostgreSQL/Redis, and Variant X (realtime extraction before practical/submission extraction). ADR-0001 records the accepted target; earlier recommendations/questions above are historical context, not unresolved alternatives.

The response inventory was reviewed against all 47 adapter files at source revision `051a654e52d484bfaea5a72775841a618fb22881`. It now captures literal status codes and explicitly observed response headers, including `/api/live` no-store and `/api/jobs/[jobId]`'s missing-jobId 400 branch. Shared execution error/guest-cookie contracts reference their helper instead of silently assuming the adapter's literals are exhaustive. A missing dynamic path segment may not reach the handler through normal framework routing; the 400 is still a handler contract to preserve.

Header values are conditional observations: cached health and queue responses can have different headers from failures. Forwarded service/auth errors, automatic framework methods, body-size/abort/timeout behavior and dynamic pagination values still require real network characterization in the extraction PRs. No static inventory is proof of every runtime branch.

The original page `owner` fields name associated backend extraction slices, not authorization to move a frontend page into API. Frontend feature extraction follows issues16–19C; all page URLs stay in Next.js.

No historical test counts or local output have been relabelled as newly executed. The correction PR records fresh checks separately. Release migrations remain controlled; SQL bytes, app behavior, credentials and volumes are unchanged.
