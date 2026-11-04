# Architecture migration status

Reviewed against master `a8425a352cc355c12906c8af93a517f136d610ec` and branch `refactor/cr-arch-09-3a` (CR-ARCH-09 / Issue 3A / #49).

## Current versus destination

| Area | Current implementation | Recommendation and remaining work |
| --- | --- | --- |
| Applications | `apps/web`, `apps/worker`, `apps/api` | Fastify API workspace created; three application workspaces; complete separation remains scheduled for 3J |
| HTTP | `/api/live` migrated to `apps/api`; 46 route files remain in `apps/web/src/app/api` | Continue moving feature adapters and API-only services into `apps/api/src/modules` per batch schedule (3B: auth, etc.); preserve URLs, auth, headers and responses |
| Realtime | Web custom server owns Socket.IO | Socket.IO migration to API scheduled for 3C (CR-ARCH-14) |
| Frontend features | Coding-workspace, practice, credential PDF and practical-authoring extractions landed | Finish submission/reports/user workflows as separate slices; route files assemble views |
| Core | Browser PDF implementation removed; explicit runtime environment export added | Retain only genuinely shared backend rules; move API-only services, retire facades after consumers migrate |
| Tooling | Root tooling includes explicit lint dependencies, backend correctness rules, and covers `apps/api` | Continue expanding checks as each module migrates |
| Database | SQL assets and lifecycle scripts still under root `database/` | Consolidate under database package without changing migration names/checksums |
| Runtime/deployment | Fastify API service wired into same-origin gateway, root commands, Dockerfile, and Compose overlays | After all cutovers, standard Next.js web plus independent API/worker artifacts and gateway |

## Next dependency order

Follow [ADR-0001](decisions/0001-api-runtime-and-hosting.md) and the [route inventory](route-inventory.json).

| Order | Planned work identifier | Status | Deliverable |
| --- | --- | --- | --- |
| 1 | CR-ARCH-09 | Implementation in PR #59; completion requires final CI | Fastify API workspace, bootstrap/lifecycle/container/gateway wiring; migrated `/api/live` with real direct and gateway contract tests; old Next handler removed |
| 2 | CR-ARCH-10A | Next (3B / #50) | Auth adapters/shared middleware and identity/password contracts |
| 3 | CR-ARCH-14 | Blocked on 10A (3C / #51) | Socket.IO moves from web to API, including worker transport and room/session ownership tests (Variant X) |
| 4 | CR-ARCH-10B and CR-ARCH-11A | After 10A (3D / #52, 3E / #53) | User-management and course/department/mapping HTTP slices; coordinate shared-file edits |
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
