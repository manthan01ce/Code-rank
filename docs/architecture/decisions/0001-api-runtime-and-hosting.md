# ADR-0001: API runtime, gateway and local lab topology

| Field | Decision |
| --- | --- |
| Status | Accepted for the initial local lab implementation |
| Owner decisions | Fastify; same-origin gateway; local lab Docker; Variant X, selected in this conversation on 3 November 2026 |
| Foundation issues | #19 (01A), #20 (01B) |
| Original foundation PRs | #21 (baseline), #23 (ADR draft) |
| Source reviewed for this correction | `051a654e52d484bfaea5a72775841a618fb22881` |
| Implementation status | Planned. This ADR does not create apps/api or deploy the target. |

This decision replaces the earlier draft's blank owner fields and inconsistent alternatives. The owner reaffirmed the folder-structure review's three-application architecture. The initial implementation targets the local Linux lab; it does not assume a cloud subscription, domain, budget, remote credentials or staging access.

## 1. Accepted application ownership

| Owner | Responsibility | Dependency limits |
| --- | --- | --- |
| apps/web | Next.js pages, browser interaction, features under src/features | After separation, no core/database/queue/runner implementation imports or backend secrets, including SSR paths; server rendering accesses API through HTTP |
| NEW apps/api | Fastify HTTP endpoints and Socket.IO; feature adapters/use cases under src/modules | No Next.js, React, runner or Docker access |
| apps/worker | Queue processing, grading orchestration and sandbox execution | Uses shared backend rules/database/runner; only application needing Docker-daemon access |
| packages/core | Backend rules genuinely shared by API and worker | No browser PDF generation, HTTP framework or frontend imports |
| packages/database | Connection/transaction/readiness/migration mechanics and lifecycle assets | Does not own user/course business policy |
| packages/queue | Admission, queue transport, ownership and worker readiness | Preserve atomic Redis admission |
| packages/runner | Bounded sandbox mechanics and language execution | Independent of applications and core |

Do not create apps/realtime, retain Socket.IO in web as the final design, or split each role/feature into a service. Roles express navigation/access policy; server authorization remains mandatory. Preserve existing JavaScript/TypeScript extensions during ownership moves.

## 2. HTTP framework decision

**Decision: Fastify**, with a compatible supported major selected and locked at issue09 implementation. The current Fastify v5 guide requires Node 20 or later; the repository declares Node >=24, so the earlier draft's Node >=18 claim is removed. Issue09 must check the exact package/plugin compatibility and lockfile, declare direct API dependencies and avoid unrelated upgrades.

Rationale: plugin-based feature routing and validation provide a clear adapter boundary. Hono was considered for Fetch API similarity; Express 5 for familiar middleware. Neither was selected.

NextResponse is a Next.js extension of the standard Response API. It can be imported by Node when Next is installed, but retaining it would violate the API's independence. Rewrite request/response/cookie adapters using Fastify. Preserve actual behavior, not the old API shape of framework helper calls.

Use Fastify injection for focused adapter checks where useful, AND real listening HTTP tests for extraction acceptance. Injection alone does not prove gateway behavior, socket upgrades, aborts, request-size limits or network timeouts.

Do not invent plugin names or assume middleware cancels work. Issue09/feature PRs must verify documented parser/multipart/body-limit/error/timeout behavior and characterize current contracts first.

## 3. Same-origin gateway decision

**Decision: one browser origin.** The gateway serves page traffic from web and routes migrated API paths to API, with exactly one /api prefix. Socket.IO upgrades go to the current realtime owner during migration and API after issue14.

The specific reverse-proxy implementation belongs to issue09. It must forward WebSocket upgrades, Authorization, Cookie and Set-Cookie correctly and preserve status/body/cache/retry/pagination semantics. Browser clients retain existing relative URLs. Explicit browser public address, API internal address and worker REALTIME_URL have different meanings.

Next.js supports external rewrites, including fallback rewrites after local route matching. The earlier draft's claim that rewrites only happen client-side is incorrect. A web-to-API development fallback may keep existing handlers authoritative while migrated paths reach API. Verify behavior against the installed Next version. External production gateway routes must express the same one-owner cutover; a broad /api route must not bypass still-unmigrated handlers.

For each migration PR:
1. Characterize the existing handler first.
2. Add the API adapter and tests.
3. Delete its old Next.js handler and switch routing in the same reviewed change.
4. Prove the URL has one authoritative handler and both direct/API and public-gateway behavior agree.

Do not enable permissive CORS unnecessarily. If separate origins are ever proposed, require a new ADR: cross-origin and cross-site are different concepts, so SameSite=None is not automatically required merely by using a different origin.

## 4. Initial hosting and operational decisions

**Decision: local lab Docker on a Linux host**, with local PostgreSQL and Redis. Three application artifacts plus supporting services are the target. Host-based web/API/worker development remains a documented mode alongside container operation.

No paid hosting, remote staging host or public domain is selected. These are external prerequisites for later hosted verification, not hidden blanks blocking local ownership work. The lab's actual OS/network/browser WebSocket reachability and available Docker access must be tested on its hardware. Capacity results apply only to recorded hardware/topology; they are not general throughput guarantees.

Do not publish database/Redis to untrusted networks. Preserve existing volumes/project mappings during Compose consolidation; never use destructive resets as rollback. First-volume bootstrap SQL and ledger-managed migrations are distinct. Run release migrations explicitly, never inside readiness probes.

Cloud hosting is outside this initial target. Root vercel.json and infrastructure/vercel.json do not define the complete accepted stack. Keep them untouched until cutover; after local separation is verified, retire these competing unsupported deployment configs in the runtime/deployment cleanup PR. A future cloud/Vercel deployment needs its own compatible artifact/gateway decision and tests. No claim about future provider WebSocket products is needed to justify this local topology.

## 5. Runtime and process-management decisions

Web uses standard Next.js serving after API/realtime cutover. Do not remove server.js or cluster.js early: they currently supply behavior that must move or be replaced first. Standard serving does not require standalone packaging; choose and test packaging separately. Standalone output does not trace custom server code.

API is a long-running process with explicit listen/readiness/drain/shutdown handling. For the initial lab, start with one API instance; test supported replica behavior separately before calling replication production-ready. Use service/container process management rather than blindly moving the Next.js cluster launcher. Redis fan-out remains required whenever multiple realtime instances are used.

After cutover, remove the combined web custom-server/cluster responsibility and its obsolete dependencies only when parity tests pass. This does not authorize loss of graceful shutdown, connection handling or logging.

## 6. Realtime transport and ordering

**Decision: Variant X.**

Hard ordering:
- 09 (API bootstrap), then 10A (shared auth/middleware), then 14 (Socket.IO migration).
- 11B and 12A require 14; 12B requires 12A and the established realtime boundary.
- 15 requires all HTTP slices and realtime migration complete.

Current source evidence:
- web/server.js sets global.io and owns the Socket.IO server.
- practical-events.js prefers in-process publication and otherwise opens a transient service-token Socket.IO client, with a 1000ms handshake timeout and 1500ms disconnect timer.
- The worker publishes over a persistent service-token Socket.IO client connection.
- The Redis adapter distributes Socket.IO room packets between server instances; it is not a direct practical-route publication mechanism.

Target publication:
- API-local mutations publish through an explicit API realtime publisher referencing its Socket.IO instance, rather than a global browser/server barrel.
- Worker-to-API service events retain authenticated Socket.IO, fresh service credentials on reconnect and existing event payload/ownership checks.
- Where a separate-process API publisher is actually required, use the existing authenticated Socket.IO protocol with bounded lifecycle; do not silently invent an unauthenticated webhook or direct Redis publisher.
- Preserve the current boundary in which practical notification failure does not roll back a successful persisted mutation. Reliability redesign is separate work.

Keep browser useSocket and browser socket-auth in web. Move session verification, membership checks, service publication handling, Redis adapter and server lifecycle into API. Verify browser/service token expiry, revoked rooms, guest lifetime, forbidden service subscriptions, forged browser publication denial and job ownership.

WebSocket-only remains the initial supported transport. This preserves the existing transport policy; if a lab proxy blocks upgrades, resolve that explicitly before claiming lab readiness rather than enabling polling silently. WebSocket-only avoids polling affinity requirements; enabling polling later requires a documented sticky-session configuration.

Redis requestsTimeout is for inter-server requests, not a blanket maximum event-delivery latency. Redis does not provide application-level exactly-once delivery or deduplicate two independently published copies of the same business event. Test fan-out and duplication behavior explicitly.

## 7. Constraints disposition

| Constraint | Disposition |
| --- | --- |
| Hosting budget/tier | No cloud purchase or tier assumed; local lab selected |
| Persistent service | Required for API/Socket.IO; local container process |
| Docker host | Linux lab host; worker access only; actual daemon readiness must be verified |
| PostgreSQL and Redis | Local services, preserving existing data/volume identity |
| External staging access | Not provided or selected; hosted issue26B remains externally gated |
| Domain arrangement | Same browser origin; local gateway address/ports specified by setup/API issues |
| Transport/network | Preserve WebSocket-only; verify actual lab network |
| Framework | Fastify selected; exact supported package/plugin versions verified in issue09 |
| Realtime sequence | Variant X selected |
| API publisher and worker transport | API realtime publisher plus authenticated worker Socket.IO; preserve contracts |

These are accepted implementation constraints, not assertions that infrastructure already exists.

## 8. Completion gates and handoff

01A is a source baseline, not an exhaustive route characterization. The corrected inventory includes literal status/header observations and explicit shared execution contracts. Forwarded errors and transport behavior require real tests.

Issue09 must create the API workspace/bootstrap/container wiring, route stubs registered once, a development proxy and production-gateway contract. Migrate only /api/live initially; preserve {status:'ok',timestamp:<ISO>} with HTTP 200 and Cache-Control:no-store. Verify API startup without web and no duplicate handler. Extend lint, boundary tests and CI for the real deployed components.

Issue14 must move realtime before practical/execution slices and verify service authentication, browser room/job ownership, expiry/revocation, worker reconnect/drain and Redis cross-replica delivery. Local single-instance deployment is not evidence for fan-out.

Issue15 must prove web runs without backend packages/secrets or the API process, API runs without Next.js/React, and neither web nor API uses runner/Docker. Adapt stack and authenticated tests in the same implementation PRs as topology changes, not only in the final release check.

Keep CI PR-only per merged PR #22. Preserve all assertions and capacity/security gates; a documentation change does not justify weakening failures. Final local verification (26A) and external staging verification (26B) retain their distinct prerequisites.

Revert corrections through a PR, never by resetting databases or volumes.

## 9. References and verification limits

Primary documentation reviewed 3 November 2026:
- Fastify v5 migration guide: https://fastify.dev/docs/latest/Guides/Migration-Guide-V5/
- Next.js rewrites: https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites
- Socket.IO multi-node deployment: https://socket.io/docs/v4/using-multiple-nodes/
- Socket.IO Redis adapter: https://socket.io/docs/v4/redis-adapter/
- Next.js custom server: https://nextjs.org/docs/app/guides/custom-server

Repository source is the evidence for current behavior; official documents explain framework semantics and do not prove this application passed runtime checks. This correction changes documentation, inventory and architecture assertions only. It does not install Fastify, move handlers, deploy services or alter the database.
