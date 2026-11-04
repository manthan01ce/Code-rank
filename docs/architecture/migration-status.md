# Architecture migration status

Reviewed against master `a8425a352cc355c12906c8af93a517f136d610ec` and branch `refactor/cr-arch-09-3a` (CR-ARCH-09 / Issue 3A / #49).

## Current versus destination

| Area | Current implementation | Recommendation and remaining work |
| --- | --- | --- |
| Applications | `apps/web`, `apps/worker`, `apps/api` | Fastify API workspace created; three application workspaces; complete separation remains scheduled for 3J |
| HTTP | `/api/live`, auth, courses, departments, and mapping endpoints migrated to `apps/api`; 38 route files remain in `apps/web/src/app/api` | Continue moving feature adapters and API-only services into `apps/api/src/modules` per batch schedule (3D: users, 3F: practicals, etc.); preserve URLs, auth, headers and responses |
| Realtime | Fastify API owns authoritative Socket.IO; Next.js server proxies `/socket.io` WebSocket upgrades | Web Socket.IO server completely eliminated; browser hooks and transitional publishers point to API |
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
| 4 | CR-ARCH-10B and CR-ARCH-11A | CR-ARCH-11A verified in PR #53 (3E); CR-ARCH-10B (3D / #52) | User-management and course/department/mapping HTTP slices; coordinate shared-file edits |
| 5 | CR-ARCH-11B and CR-ARCH-12A | Blocked on 14 + 11A (3F / #54, 3G / #55) | Practical-management and execution HTTP slices; preserve event publication and execution contracts |
| 6 | CR-ARCH-12B | Blocked on 12A + 11B (3H / #56) | Submission/history/reset/workspace HTTP slice |
| 7 | CR-ARCH-13 | Blocked on 10B + 12B (3I / #57) | Operations/profile remaining HTTP slice; preserve readiness without running migrations |
| 8 | CR-ARCH-15 | Every slice complete (3J / #58) | Complete web/API separation; remove web backend imports/secrets/custom Socket.IO server only now |

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
