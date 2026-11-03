# ADR-0001: API Runtime, Framework, Origin/Gateway, Hosting, and Event Transport

| Field | Value |
|---|---|
| **Status** | Proposed — Awaiting owner decisions |
| **Issue** | #20 — CR-ARCH-01B |
| **Branch** | `refactor/cr-arch-01b-api-runtime-hosting-adr` |
| **Baseline evidence** | `docs/architecture/baseline-2026-11.md` (PR #21, commit `e8cd0a5e`) |
| **Route inventory** | `docs/architecture/route-inventory.json` |
| **Date drafted** | 2026-11-03 |
| **Blocks** | CR-ARCH-09 (API runtime/bootstrap), CR-ARCH-14 (realtime extraction) |
| **Blocked by** | #19 (CR-ARCH-01A) — merged ✓ |

---

## 1. Context and Motivation

Separating the monolithic `apps/web` (Next.js pages + API routes + Socket.IO, all in one Node process) into distinct `web`, `api`, and `worker` apps requires making explicit decisions that are currently implicit in the single-process topology. Copying route files without these decisions can silently break:

- Realtime event delivery (in-process `global.io` disappears the moment API routes run in a separate process)
- Cookie/token forwarding across origins
- WebSocket upgrade routing when the Socket.IO server lives in a different process than the HTTP API
- Process management for the custom `server.js` / `cluster.js` entrypoints, which cannot exist unchanged in two apps
- Hosting compatibility: Socket.IO requires a persistent TCP process; Vercel serverless Functions cannot hold open WebSocket connections

**This document presents options and trade-offs for owner review. No decision is made by the author. All "Owner decision" fields are intentionally blank.**

---

## 2. Verified Current Topology (Source Evidence)

All claims in this section are backed by source file reads performed during branch preparation. Runtime behaviour (actual socket counts, latency, failover) was not observed; claims are limited to static source evidence.

### 2.1 Process model

| Entrypoint | File | What it owns |
|---|---|---|
| `apps/web/server.js` | Custom HTTP + Socket.IO | Next.js app (`app.prepare()` → `handle()`), Socket.IO server bound to the same `http.Server`, `global.io = io` set here, compression middleware, JWT auth middleware |
| `apps/web/cluster.js` | Cluster wrapper | Forks `server.js` workers; **requires `REALTIME_REDIS_ENABLED=true`** (hard-coded guard); uses `@socket.io/redis-adapter` for cross-worker fan-out |
| `apps/worker/src/index.js` | BullMQ worker | Connects to Redis queue; connects to `REALTIME_URL` (default `http://127.0.0.1:3000`) via `socket.io-client` with a service token |
| `npm start` (apps/web) | → `node cluster.js` | Production entrypoint |
| `npm run dev` (apps/web) | → `node server.js` | Development entrypoint |

`output: 'standalone'` is explicitly commented out in `apps/web/next.config.mjs` with the annotation: *"incompatible with custom server.js"*. Standard `next start` is therefore not a drop-in replacement for `node server.js`.

### 2.2 Socket.IO topology today

```
Browser (useSocket.js)
  └── WebSocket → ws://origin/socket.io  → server.js io instance
                                              ├── attachRealtime() — handles:
                                              │     join_practical_room
                                              │     join_course_room
                                              │     watch_job
                                              │     worker_job_complete   ← service only
                                              │     worker_submission_saved ← service only
                                              │     faculty_practical_*    ← service only
                                              └── guardRealtimeSession()

apps/worker (submission.worker.js)
  └── WebSocket → REALTIME_URL/socket.io → same io instance (service token auth)
        emits: worker_job_complete, worker_submission_saved

apps/web route handlers (practical-events.js)
  ├── if global.io exists → in-process emit to course room (primary path today)
  └── else → transient socket.io-client to REALTIME_URL (fallback, fire-and-forget)
```

**Key finding confirmed in source:** There is no HTTP webhook publisher, no direct Redis pub/sub publisher, and no persistent API→realtime connection. Event delivery relies entirely on Socket.IO — either in-process (`global.io`) or cross-process (transient or persistent `socket.io-client`).

### 2.3 Route adapter pattern

All 47 API route handlers in `apps/web/src/app/api` use the Next.js App Router convention (`export async function GET/POST/...`). They return `NextResponse` objects and read requests via the Next.js `Request` wrapper. The `execution-api.js` helper imports and returns `NextResponse` directly:

```js
// apps/web/src/lib/execution-api.js
import { NextResponse } from 'next/server';
...
return NextResponse.json({ success: true, jobId, status: 'queued' }, { status: 202 });
```

`NextResponse` is a Next.js-specific subclass of the Web `Response` API with additional helpers (`NextResponse.json`, `.cookies.set`, `.redirect`). It is **not** portable to a plain Node HTTP framework without rewriting the helpers. However, the underlying data shapes (JSON bodies, status codes, header values, cookies) are framework-independent and can be expressed in any HTTP framework; the cost is rewriting the adapter layer, not the business logic in `packages/core`.

### 2.4 Authentication contracts

| Auth mode | Mechanism | Verified in |
|---|---|---|
| Bearer (user) | JWT in `Authorization: Bearer <token>` header, verified by `authenticateToken` | `packages/core/src/security/active-actor.js` |
| Admin role check | Same JWT, `actor.role === 'admin'` assertion | Same |
| Faculty role check | Same JWT, `actor.role === 'faculty'` | Same |
| Student role check | Same JWT, `actor.role === 'student'` | Same |
| Guest | Opaque cookie (`GUEST_COOKIE`), created fresh if absent | `packages/core/src/security/execution.js` |
| Service token (worker/API→realtime) | 5-minute HS256 JWT `{ role: 'service', aud: 'coderank-realtime', iss: 'coderank-worker' }` | `packages/core/src/security/service-token.js` |

### 2.5 Vercel configuration

| File | `framework` | `buildCommand` | `outputDirectory` |
|---|---|---|---|
| `vercel.json` (root) | `nextjs` | `npm run build --workspace=apps/web` | `apps/web/.next` |
| `infrastructure/vercel.json` | `nextjs` | `turbo run build --filter=@coderank/web` | `apps/web/.next` |

Both configs target a Next.js build. Neither config references `server.js` or `cluster.js`; Vercel runs its own serverless function infrastructure when `framework: nextjs` is declared. Socket.IO would not be invocable from Vercel Functions because Functions are stateless HTTP handlers with no persistent process.

### 2.6 `useSocket.js` browser base URL

```js
globalSocket = io(process.env.NEXT_PUBLIC_REALTIME_URL || window.location.origin, {
  path: '/socket.io',
  transports: ['websocket'],
  ...
});
```

The browser connects to `NEXT_PUBLIC_REALTIME_URL` if set, otherwise falls back to `window.location.origin`. This means the Socket.IO server must either share the web origin (same-origin `/socket.io` upgrade) or the env var must point to a separate origin. Both are viable; the choice affects CORS configuration.

---

## 3. Owner Constraints — Unknown at Drafting

The following information is required before any implementation issue can begin. Fields left blank for owner to fill.

| # | Constraint | Owner answer |
|---|---|---|
| C-01 | **Hosting budget and tier** — Does the project run on a free tier (Vercel Hobby, Railway free, Fly.io free) or a paid plan that allows persistent TCP processes? | _(blank)_ |
| C-02 | **Persistent process support** — Is the chosen API/realtime host able to run a long-lived Node process (not a serverless Function)? Required for Socket.IO. | _(blank)_ |
| C-03 | **Worker Docker host** — Where does `apps/worker` run? It requires a Docker daemon for sandbox execution. Does the host allow Docker-in-Docker or a privileged container? | _(blank)_ |
| C-04 | **PostgreSQL host** — Managed service (Neon, Supabase, Railway), self-hosted on the same VM, or other? | _(blank)_ |
| C-05 | **Redis host** — Managed (Upstash, Redis Cloud), self-hosted container, or other? Is Redis already provisioned? | _(blank)_ |
| C-06 | **Staging/preview access** — Is there a staging environment? Will preview deployments need Socket.IO, or is static Next.js sufficient for previews? | _(blank)_ |
| C-07 | **Custom domain arrangement** — Is there one domain (e.g. `coderank.example.com`) for everything, or separate subdomains (e.g. `api.coderank.example.com`)? | _(blank)_ |
| C-08 | **Realtime transport requirements** — Is WebSocket-only acceptable, or must the system support HTTP long-polling fallback? (Polling requires sticky sessions on multi-replica deployments.) | _(blank)_ |
| C-09 | **Lab environment OS / network** — Is the lab environment behind NAT or a proxy that might block WebSocket upgrades? | _(blank)_ |
| C-10 | **F-REALTIME sequencing preference** — Variant X (realtime extracted before practical/submission routes) or Variant Y (cross-process publishing proven in CR-ARCH-09, realtime extracted last)? (See Section 8.) | _(blank)_ |

---

## 4. Decision A — HTTP Framework / Router for `apps/api`

### 4.1 Problem statement

`apps/api` will own the 47 HTTP route handlers currently in `apps/web/src/app/api`. These handlers today return `NextResponse` and accept the Next.js `Request` subclass. A new process running without Next.js requires a different HTTP framework. The shared business logic in `packages/core` is framework-independent; only the adapter layer (request parsing, response construction, cookie serialization) needs rewriting.

**Status: Proposed — Awaiting owner**

**Owner decision:** _(blank)_

**Owner rationale:** _(blank)_

### 4.2 Why `NextResponse` cannot be copied unchanged

`NextResponse` is exported from `next/server`, a package that is only available inside a Next.js build. It wraps the [WHATWG Fetch `Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) but adds:

- `.cookies.set()` / `.cookies.delete()` — convenience wrappers for `Set-Cookie`
- `NextResponse.json()` — sets `Content-Type: application/json`
- `NextResponse.redirect()` — with Next.js-specific rewrite semantics
- `NextResponse.rewrite()` — not relevant to API routes

The underlying shape (JSON body, HTTP status codes, `Set-Cookie` headers, `Authorization` bearer token) is standard and maps cleanly to any framework. The work is rewriting `~47 route files × ~5–30 lines of adapter code`, not rewriting `packages/core` services.

### 4.3 Options

#### Option A-1: Fastify v4/v5

**Evidence:** Fastify 5.x supports Node ≥ 18. CodeRank requires Node ≥ 24 (`.nvmrc`, `engines.node`). Fastify ships a schema-based validation layer (JSON Schema / `ajv`) and a plugin system. Multipart/form-data is handled by `@fastify/multipart`.

| Criterion | Assessment |
|---|---|
| Multipart uploads (`/api/admin/bulk-upload`, `/api/users/bulk`) | `@fastify/multipart` required; streaming bulk-users pattern supported |
| Body size limits | Configurable per-route via `bodyLimit` |
| Error mapping | Centralized `setErrorHandler`; maps to existing `{success,error}` JSON shape |
| Abort / request timeouts | `@fastify/request-timeout` plugin or manual `request.raw.socket.setTimeout` |
| Streams | Node.js streams pass through; response streaming supported |
| Auth middleware | Hooks (`preHandler`); framework-independent JWT verify from `packages/core` |
| Testability | `fastify.inject()` — in-process HTTP injection without network; compatible with Node test runner |
| Ecosystem maturity | Maintained; used in production at scale (source: [Fastify docs](https://fastify.dev/), accessed 2026-11-03) |

Advantages: fast cold start, built-in schema validation, plugin isolation, excellent TypeScript support.

Costs/risks: Team familiarity unknown; `@fastify/multipart` API differs from `request.formData()`; all 47 adapters need rewriting to Fastify route syntax.

Migration changes: `apps/api` declares `fastify`, `@fastify/multipart`, `@fastify/cors`, `@fastify/cookie` as direct dependencies; does not import from `next/server`.

Verification: `fastify.inject()` tests for each migrated route covering status codes, headers, and cookie contracts from `docs/architecture/route-inventory.json`.

#### Option A-2: Hono (Web-standard)

**Evidence:** Hono uses the WHATWG Fetch `Request`/`Response` API natively, matching the interface that the existing route handlers expect. A thin compatibility shim for `NextResponse.json()` and `NextResponse.cookies.set()` could reduce per-route rewrite effort.

| Criterion | Assessment |
|---|---|
| Multipart uploads | `hono/body-parser` supports `multipart/form-data`; streaming chunked support varies by adapter |
| Body size limits | Configurable via middleware |
| Error mapping | `app.onError()` hook |
| Abort / request timeouts | Handled at Node HTTP server layer; Hono itself is adapter-agnostic |
| Streams | Web Streams API; interoperable with Node streams via adapters |
| Auth middleware | Standard middleware; JWT verify from `packages/core` |
| Testability | `app.request()` helper for in-process testing |
| Ecosystem maturity | Active development; smaller ecosystem than Fastify (source: [Hono docs](https://hono.dev/), accessed 2026-11-03) |

Advantages: closest surface to the current Next.js `Request`/`Response` API; smaller rewrite per file; runs on multiple runtimes if portability is later needed.

Costs/risks: `NextResponse.cookies.set()` still requires a shim; smaller plugin ecosystem; less established for large production deployments.

Migration changes: `apps/api` declares `hono`, `@hono/node-server` as direct dependencies.

Verification: Same contract test approach as A-1.

#### Option A-3: Express v5

**Evidence:** Express 5 is stable as of 2024 (source: [Express changelog](https://expressjs.com/en/changelog/5x.html), accessed 2026-11-03). Node ≥ 18 required; Node ≥ 24 in use.

| Criterion | Assessment |
|---|---|
| Multipart uploads | `multer` or `busboy` required |
| Body size limits | `express.json({ limit })` |
| Error mapping | `(err, req, res, next)` four-argument handler |
| Abort / request timeouts | `connect-timeout` middleware |
| Streams | `res.write()` / `res.end()` |
| Auth middleware | Standard `req`, `res`, `next` pattern; JWT from `packages/core` |
| Testability | `supertest` for in-process injection |
| Ecosystem maturity | Largest Node.js HTTP ecosystem; team likely familiar |

Advantages: highest team familiarity probability; largest ecosystem; most Stack Overflow answers.

Costs/risks: No built-in schema validation; Express 5 is newer and less battle-tested at scale than v4; callback-based error handling is less ergonomic than async-native frameworks.

Migration changes: `apps/api` declares `express`, `multer` as direct dependencies.

Verification: `supertest` against each migrated route.

### 4.4 Comparison matrix

| Criterion | Fastify | Hono | Express 5 |
|---|---|---|---|
| Native async/await | ✓ | ✓ | ✓ (v5) |
| Schema validation built-in | ✓ | Partial | ✗ |
| Closest to current Request/Response API | ✗ | ✓ | ✗ |
| Multipart support | Plugin | Built-in | Plugin |
| In-process test injection | `fastify.inject()` | `app.request()` | `supertest` |
| Team familiarity (assumed) | Low–Medium | Low | Medium–High |
| Production case studies | Many | Growing | Dominant |

---

## 5. Decision B — Origins / Gateway

### 5.1 Problem statement

Today all traffic — pages, API routes, and Socket.IO — is served from one origin on one port. When `apps/api` becomes a separate process, there is a choice about whether browsers still see a single origin or two separate public origins.

**Status: Proposed — Awaiting owner**

**Owner decision:** _(blank)_

**Owner rationale:** _(blank)_

### 5.2 Contracts that must be preserved regardless of choice

| Contract | Detail |
|---|---|
| `/api/*` prefix | All 47 route URLs begin with `/api/`; clients use this prefix. |
| `/socket.io` path | `useSocket.js` connects to `path: '/socket.io'` on `NEXT_PUBLIC_REALTIME_URL || window.location.origin`. |
| Bearer token | `Authorization: Bearer <token>` in request headers; must reach API process unchanged. |
| Guest cookie (`GUEST_COOKIE`) | Set by API on execution responses; must reach browser; `Secure`, `SameSite=Lax`, `Path=/`. |
| CORS | If API and web are on separate origins, `credentials: true` requires explicit `Access-Control-Allow-Origin` with the exact web origin (wildcard `*` disallows credentials). |
| Server-rendered pages accessing the API | Next.js RSC/SSR running inside `apps/web` calls API endpoints during server-side rendering; internal URL must be reachable without going through the public internet. |
| Worker → realtime | `REALTIME_URL` in worker must resolve to the Socket.IO process; this is internal, not the same as the public URL. |

### 5.3 Options

#### Option B-1: Same-origin reverse proxy (`/api/*` and `/socket.io` proxied to API process)

A reverse proxy (nginx, Caddy, or the platform's built-in routing) sits in front. The browser sees one origin. Requests to `/api/*` are forwarded to `apps/api`; WebSocket upgrades to `/socket.io` are forwarded to the Socket.IO process; everything else goes to `apps/web`.

```
Browser
  ├── GET /student  → proxy → apps/web (Next.js)
  ├── POST /api/auth/login → proxy → apps/api (HTTP framework)
  └── WS  /socket.io → proxy → apps/web socket.io (or apps/api socket.io)
```

Advantages:
- No CORS configuration needed for browser requests (same origin).
- Guest cookie `SameSite=Lax` works without changes.
- `NEXT_PUBLIC_REALTIME_URL` can remain unset; browser uses `window.location.origin`.
- Internal server-rendered API calls can use a direct URL (e.g. `http://api:PORT`) without network egress.
- Incremental cutover is straightforward: unmigrated routes stay on `apps/web`; migrated routes have one authoritative handler in `apps/api`. Old handler removed in the same PR as the migration. No fallback routing needed in Next.js itself (see note below).

Costs/risks:
- Requires a reverse proxy in the deployment stack; adds an infrastructure component.
- WebSocket proxy requires HTTP/1.1 `Upgrade` header forwarding; must be explicitly configured.
- If the proxy and the API process share a host, the proxy does not eliminate the single point of failure.

**Note on Next.js fallback routing:** Next.js 16 (in use, confirmed by `next: ^16.3.6` in `apps/web/package.json`) does not have a stable built-in `/api/*` proxy-pass feature. `next.config.mjs` `rewrites()` can forward to an external service, but Next.js still parses the route and the rewrite fires client-side on navigation. For migration correctness, the authoritative server for each route should be unambiguous — the proxy layer achieves this without relying on Next.js rewrite semantics.

#### Option B-2: Separate public origins (`api.domain.com` and `socket.domain.com`)

The API and realtime server expose their own public hostnames. The browser makes cross-origin API requests.

```
Browser
  ├── GET /student     → web.domain.com (Next.js)
  ├── POST /api/auth/login → api.domain.com/api/auth/login
  └── WS  /socket.io   → realtime.domain.com/socket.io
```

Advantages:
- Simpler infrastructure: no proxy layer, each service runs independently.
- Scale independently: API and realtime can scale to different replica counts.
- Clearer separation for observability (separate access logs, separate TLS certificates).

Costs/risks:
- **CORS configuration required** for all API endpoints: `Access-Control-Allow-Origin: https://web.domain.com`, `Access-Control-Allow-Credentials: true`.
- Guest cookie: `SameSite=None; Secure` required for cross-origin cookie sending. This requires HTTPS in production (acceptable) but changes the current `SameSite=Lax` setting.
- `NEXT_PUBLIC_REALTIME_URL` must be set at build time (baked into the client bundle).
- Server-rendered API calls from `apps/web` require the API internal URL; public domain adds latency unless internal DNS is configured.
- More environment variables to manage per environment.

#### Option B-3: Incremental same-origin cutover (hybrid, recommended as default)

Start with Option B-1. After all routes are migrated and realtime is stable, optionally move to B-2 for operational independence. This defers the CORS complexity to a later, deliberate decision.

The incremental rule: during migration, each PR migrates a batch of routes. For a given route, exactly one server owns it at any time. The migrating PR adds the handler to `apps/api` and removes the old handler from `apps/web/src/app/api`. The proxy config is updated in the same PR. This eliminates split-brain without needing Next.js to know about `apps/api`.

---

## 6. Decision C — Hosting / Deployment Topology

### 6.1 Problem statement

The separated stack requires: a frontend host (Next.js, possibly edge/serverless), a persistent API+realtime process host (Node TCP process with Socket.IO), and a worker host (Docker daemon access). PostgreSQL and Redis are external services.

**Status: Proposed — Awaiting owner**

**Owner decision:** _(blank)_

**Owner rationale:** _(blank)_

### 6.2 Constraints from source

- `apps/worker` requires a Docker daemon to spawn sandbox containers. Only the worker needs this; neither web nor API may import from `packages/runner` or access Docker (confirmed: `packages/runner` is only in `apps/worker/package.json` dependencies).
- Socket.IO requires a persistent TCP process. Vercel Serverless Functions and Netlify Functions cannot hold WebSocket connections (source: [Vercel docs — WebSockets](https://vercel.com/docs/functions/limitations), accessed 2026-11-03).
- `apps/web/cluster.js` enforces that multi-worker mode **requires** `REALTIME_REDIS_ENABLED=true` (hard-coded `throw` on startup if not set).
- `output: 'standalone'` is disabled in `next.config.mjs`; `apps/web` must be served by `node cluster.js` (which calls `server.js`).

### 6.3 Options

#### Option C-1: All three processes on the same VM / container host (self-hosted, e.g. a VPS)

Single VM runs: `apps/web` (cluster.js), `apps/api` (new HTTP server), `apps/worker` (BullMQ worker). Nginx proxies on port 80/443.

Advantages: simplest networking (all processes reachable on localhost); lowest operational overhead; cheapest.

Costs/risks: single point of failure for the entire stack; scaling requires vertical upgrade or a more complex setup; Docker daemon available (needed for worker).

Deployment order: PostgreSQL and Redis first (or external managed), then web, api, worker. Readiness checks must pass before serving traffic.

Rollback: restart previous container or revert systemd unit to previous image tag.

Secrets ownership: injected via `.env` on the host or a secrets manager.

#### Option C-2: Platform-as-a-Service — persistent process platforms (Railway, Fly.io, Render)

Each app (`web`, `api`, `worker`) becomes a separate service on the platform. PostgreSQL and Redis are platform add-ons or external.

Advantages: managed TLS, rolling deploys, health checks, auto-restart; scales per service; Docker build from existing `Dockerfiles` supported.

Costs/risks: cost increases with replicas; worker Docker daemon access requires a privileged container or a Docker-in-Docker sidecar (check platform support); networking between services is internal (private network hostnames, not `localhost`); `REALTIME_URL` in worker must point to the web/api service's internal address.

Fly.io note: supports persistent volumes and `fly machines run` for Docker-capable workloads (source: [Fly.io docs](https://fly.io/docs/), accessed 2026-11-03). Worker sandbox isolation needs validation on the platform.

Deployment order: provision Redis → provision PostgreSQL → deploy web (REALTIME_REDIS_ENABLED=true, REDIS_HOST set) → deploy api → deploy worker (REALTIME_URL=internal web address).

Rollback: platform rollback to previous deployment version per service.

#### Option C-3: Mixed — Vercel for web, persistent platform for API+realtime+worker

`apps/web` deploys to Vercel (no custom server.js; requires switching to `next start` with `output: 'standalone'`). `apps/api` + `apps/web`'s Socket.IO process run on a persistent platform. `apps/worker` runs on Docker-capable host.

**This option requires removing `server.js` and `cluster.js` from the web serving path**, enabling `output: 'standalone'`, and running `next start` instead. This is a prerequisite step, not part of this ADR's scope.

Advantages: Vercel handles global CDN, edge caching, preview deploys for the Next.js app.

Costs/risks: `output: 'standalone'` re-enablement requires verifying that all monorepo workspace imports resolve correctly in standalone mode (currently disabled specifically due to the custom server). Socket.IO cannot run on Vercel; a second persistent host is required. Two separate deployments to coordinate on every release.

**Note:** Neither Vercel config today (`vercel.json`, `infrastructure/vercel.json`) references `server.js`. If either config were deployed to Vercel as-is, Vercel would run Next.js without the Socket.IO server, breaking realtime. This is a current deployment hazard documented here for owner awareness.

#### Option C-4: Full Kubernetes / Docker Compose (self-hosted, multi-replica)

`docker-compose.yml` or `infrastructure/docker-compose.yml` already defines the full stack. Extending to Kubernetes is straightforward from the existing Docker images.

Advantages: maximum control; HPA for web/api; worker can run privileged DinD or Docker socket mount.

Costs/risks: highest operational complexity; requires Kubernetes expertise; out of scope for current team size unless already using it.

### 6.4 Deployment order (all options)

Regardless of platform, the safe deployment order is:
1. PostgreSQL schema migrations (readiness checked by `packages/database/src/required-migrations.json`).
2. Redis available (required by BullMQ and optionally by Socket.IO adapter).
3. `apps/web` (or API+realtime process, whichever holds the Socket.IO server) — health check passes.
4. `apps/api` — health check passes (`/api/live` returns 200).
5. `apps/worker` — connects to Redis queue and to `REALTIME_URL`.

**Readiness must never run migrations.** The `required-migrations.json` manifest is a read-only check, not an auto-migrate trigger. This is confirmed in `packages/database/src/readiness.js`.

---

## 7. Decision D — Existing Configuration / Process Fate

### 7.1 Root `vercel.json`

**Current state:** Targets `apps/web` Next.js build. Does not reference `server.js`. If deployed to Vercel today, Socket.IO would not be initialized (Vercel's serverless runtime calls `next start`, not `node cluster.js`).

**Options:**

| Option | Action | Condition |
|---|---|---|
| D-1a | Keep as-is; accept that Vercel deployment does not support realtime | If owner chooses Vercel for web only and moves realtime to a separate persistent host |
| D-1b | Delete root `vercel.json`; use only `infrastructure/vercel.json` | If Vercel is not the target for the web app at all |
| D-1c | Update to point to a Vercel-compatible `apps/web` serving mode | Requires enabling `output: 'standalone'` and removing custom server dependency |

**Removal condition:** Only after backend/realtime is confirmed running on a non-Vercel persistent host and web is validated on Vercel without Socket.IO. Not part of this PR.

**Status: Proposed — Awaiting owner**

**Owner decision:** _(blank)_

**Owner rationale:** _(blank)_

### 7.2 `infrastructure/vercel.json`

**Current state:** Alternative build config using Turbo. Same Vercel constraints apply.

**Options:**

| Option | Action | Condition |
|---|---|---|
| D-2a | Keep; use as the authoritative Vercel config if Vercel is chosen | Rename or consolidate with root config to avoid confusion |
| D-2b | Delete; Vercel deployment is not planned | If owner selects a non-Vercel host |
| D-2c | Update build command to include `apps/api` build if both web and api build at deploy time | Only if a non-Next.js API build is Vercel-hosted (not recommended given Socket.IO constraint) |

**Status: Proposed — Awaiting owner**

**Owner decision:** _(blank)_

**Owner rationale:** _(blank)_

### 7.3 `apps/web/server.js` fate

**Current state:** Custom HTTP server that combines Next.js request handling with Socket.IO initialization. Sets `global.io`. Used by all production and development deployments today.

**Options:**

| Option | Action | Notes |
|---|---|---|
| D-3a | Keep in `apps/web`; Socket.IO stays co-located with Next.js | Simplest; Socket.IO serves at `/socket.io` on the Next.js port |
| D-3b | Move Socket.IO initialization to `apps/api`; `server.js` becomes plain Next.js serving | Requires `NEXT_PUBLIC_REALTIME_URL` to point to the API process; browser connects across origins or proxy resolves it |
| D-3c | Extract Socket.IO to a new `apps/realtime` process | Maximum isolation; additional deployment unit |

**Removal condition for `server.js`:** Only if `output: 'standalone'` is re-enabled AND verified in the monorepo context AND realtime is confirmed running elsewhere. This is a multi-step verification, not a single PR.

**Status: Proposed — Awaiting owner**

**Owner decision:** _(blank)_

**Owner rationale:** _(blank)_

### 7.4 `apps/web/cluster.js` fate

**Current state:** Forks `server.js` workers for multi-core utilization. Production `npm start` calls `node cluster.js`.

Hard constraint confirmed in source: `cluster.js` throws on startup if `CLUSTER_ENABLED=true` AND `REALTIME_REDIS_ENABLED !== 'true'`. This is correct: without the Redis adapter, Socket.IO state is per-process and browsers connected to different workers would miss each other's events.

**Options:**

| Option | Action | Notes |
|---|---|---|
| D-4a | Keep `cluster.js` as the production entrypoint; ensure Redis is always provisioned | Works today; requires Redis for multi-worker |
| D-4b | Replace cluster with process-level scaling on the platform (multiple replicas, not workers) | Each replica runs `node server.js`; Redis adapter still required |
| D-4c | Remove `cluster.js`; run single-process | Only safe on single-replica deployments; loses horizontal web scaling |

**Status: Proposed — Awaiting owner**

**Owner decision:** _(blank)_

**Owner rationale:** _(blank)_

---

## 8. Decision E — Realtime Scaling

### 8.1 Current configuration

| Feature | Current state |
|---|---|
| Redis adapter | Optional (`REALTIME_REDIS_ENABLED=true`); configured in `realtime-adapter.js` using `@socket.io/redis-adapter` with pub/sub clients |
| Transport | WebSocket only (confirmed: `transports: ['websocket']` in `server.js`, `useSocket.js`, and `submission.worker.js`) |
| Rooms | `practical_<id>`, `course_<id>`, `job_<id>` |
| Subscription cap | 64 rooms per socket (enforced in `attachRealtime`) |
| Session guard | `guardRealtimeSession` — 30-second revalidation for authenticated users; 24-hour guest lifetime; service tokens expire with their 5-minute JWT |
| Revocation | Expired subscriptions removed on revalidation failure; `socket.disconnect(true)` called |

### 8.2 Redis adapter fan-out

When multiple web replicas run (cluster mode or horizontal scaling), a client on Replica A joins `course_42`. When Replica B emits to `course_42`, the Redis adapter's pub/sub channel broadcasts the event to Replica A, which then delivers it to the connected client.

Requirements for Redis fan-out:
- Same `REDIS_HOST` / `REDIS_PORT` accessible to all replicas.
- `@socket.io/redis-adapter` configured before any connections are accepted (confirmed: `await configureRealtimeAdapter(io)` before `server.listen()`).
- `requestsTimeout: 3000` is set in the adapter; this is the maximum latency for cross-replica room emissions.

**If the Redis adapter is not configured but multiple replicas exist**, cross-replica events are silently dropped. The cluster guard in `cluster.js` prevents this for in-process clustering, but does not protect against multiple VMs/containers without Redis.

### 8.3 Load-balancer requirements

WebSocket-only transport does not require sticky sessions. Once a WebSocket connection is established to Replica A, all subsequent messages on that connection go to Replica A. The Redis adapter handles cross-replica pub/sub for room events.

**If polling is ever enabled** (`transports: ['websocket', 'polling']`): polling uses separate HTTP requests that may land on different replicas. Sticky sessions (IP hash, session cookie affinity) would then be required. This is currently not the case; WebSocket-only is enforced.

### 8.4 Session expiry and token renewal

| Actor type | Token lifetime | Revalidation |
|---|---|---|
| Authenticated user | JWT `exp` field; 7-day max (browser JWT) | `guardRealtimeSession` revalidates every 30s; on failure, socket is disconnected |
| Service (worker / API) | 5-minute HS256 JWT | Worker reconnects on `io server disconnect`; `practical-events.js` fallback generates a fresh token per invocation |
| Guest | Fixed 24-hour lifetime | No revalidation; disconnected at `expiresAt` |

### 8.5 Worker reconnect and drain

From `submission.worker.js`:
```js
socket.on('disconnect', reason => {
  if (reason === 'io server disconnect' && !realtimeClosed) socket.connect();
});
```

The worker reconnects on explicit server disconnect (e.g., token expiry triggers `socket.disconnect(true)` in `guardRealtimeSession`). It does not reconnect on network errors (Socket.IO default reconnection handles those). A fresh `createServiceToken()` is called by the auth callback on reconnection because `socket.io-client` invokes the auth callback on each connection attempt.

**Drain/shutdown:** `createShutdown` in `apps/worker/src/shutdown.js` pauses workers before closing. The worker socket is explicitly disconnected via `disconnectRealtime()` during shutdown, preventing further event emissions.

### 8.6 Replica events and room ownership

There is no per-replica room ownership. Any replica receiving a `worker_job_complete` service event re-emits `job_complete` to the `job_<id>` room. With the Redis adapter, only the replica that has clients in that room delivers the event to those clients. This is correct: multiple replicas independently relaying the same event through the Redis adapter would result in duplicate delivery. The adapter deduplicates by socket ID.

**Owner question:** If `apps/api` takes over route handling but `apps/web`'s `server.js` retains the Socket.IO server, the service event path from API route → realtime becomes a cross-process Socket.IO client call (same as the `practical-events.js` fallback today). Is this acceptable, or should Socket.IO move to `apps/api` to reduce the number of cross-process hops?

### 8.7 Publishing failures

`practical-events.js` catches errors silently: `console.warn('Practical notification failed:', error.message)`. This means a failed realtime publish does not fail the HTTP response; the mutation (create/update/delete practical) succeeds but the live update is not delivered to browsers. This is the current behavior and must be preserved in any migration.

---

## 9. Decision F — Event Transport (F-REALTIME)

### 9.1 Evidence from PR #21 baseline

The baseline identified three event publication paths (confirmed by source reads):

1. **In-process `global.io`** (primary path when `apps/web/server.js` is the runtime): `publishPractical()` in `practical-events.js` calls `global.io.to(course_<id>).emit(...)` directly. Zero network overhead, zero failure surface beyond the in-process Socket.IO queue.

2. **Transient `socket.io-client` fallback** (in `practical-events.js`): used when `global.io` is absent (i.e., when the route handler runs in a separate process from the Socket.IO server). Creates a new socket connection, emits one event, disconnects after 1500ms. No pooling, no reconnect, `reconnection: false`. Fire-and-forget; errors silently suppressed.

3. **Persistent `socket.io-client` in worker** (`submission.worker.js`): established at startup, reconnects on server disconnect, emits `worker_job_complete` and `worker_submission_saved` on job completion. This is the proven cross-process Socket.IO pattern in the codebase.

### 9.2 Variant X vs Variant Y (from PR #21 baseline §6.2)

The baseline documented this choice; it is reproduced here as a required owner decision before implementation proceeds.

**Variant X — In-process dependency sequence**

Treats `global.io` as the primary path and the transient client fallback as fragile. Realtime extraction (CR-ARCH-14) is scheduled before practical/submission route extraction (11B, 12A, 12B).

Dependency order:
```
09 → 10A → 14 (Socket.IO/realtime server decision + proven cross-process publish) → 11B → 12A → 12B → ...
```

Rationale: if 11B routes are extracted to `apps/api` before realtime is resolved, every practical mutation fires the transient socket fallback. Under high concurrency (e.g., a faculty member creating many practicals during an active lab), the transient socket pool is unbounded and each socket consumes a file descriptor until the 1500ms timeout. CR-ARCH-14 replaces this with a stable cross-process transport before 11B routes move.

**Variant Y — Cross-process fallback sequence**

Treats the existing `socket.io-client` fallback as a sufficient cross-process path. CR-ARCH-09 must prove cross-process Socket.IO publishing works before 11B/12A/12B proceed. Realtime extraction (CR-ARCH-14) is scheduled last.

Dependency order:
```
09 (must include cross-process publish verification) → 10A → 10B → 11A → 11B → 12A → 12B → 13 → 14
```

Risks: the transient fallback has a hardcoded 1500ms disconnect timer and `reconnection: false`. Under cross-container networking (API and web on different containers), DNS resolution and TLS handshake could exceed 1500ms. Events would be silently dropped with no retry. This was flagged as a known risk in the PR #21 baseline.

**Additional transport options for owner consideration (not currently implemented):**

| Transport | Description | Notes |
|---|---|---|
| Authenticated Socket.IO client (persistent, pooled) | Same as the worker pattern but from `apps/api` to the Socket.IO server | Low implementation cost; proven in the codebase; requires `REALTIME_URL` from `apps/api` to the Socket.IO process |
| Redis pub/sub (direct, bypass Socket.IO client) | `apps/api` publishes to a Redis channel; `apps/web/server.js` subscribes and calls `io.to(room).emit()` | Decouples API from Socket.IO network topology; requires Redis always available |
| HTTP webhook from `apps/api` to Socket.IO server | A new internal REST endpoint on the Socket.IO server accepts POST for room events | Adds HTTP overhead; does not materially simplify the cross-process path |

The baseline recommendation was Variant X. This ADR does not select a variant; the owner must decide.

**Status: Proposed — Awaiting owner**

**Owner decision (choose Variant X or Variant Y, or specify a modified variant):** _(blank)_

**Owner rationale:** _(blank)_

**If Variant Y is chosen, additional required owner answer:** What transport should `apps/api` use to deliver practical events to the Socket.IO server? (Persistent pooled socket.io-client / Redis pub/sub / other)

**Owner answer:** _(blank)_

---

## 10. Implementation Handoff Checklist

These items are preconditions that CR-ARCH-09 and CR-ARCH-14 implementation issues must satisfy. They are listed here for owner review, not yet assigned.

### 10.1 CR-ARCH-09 (API bootstrap — `/api/live`)

- [ ] `apps/api` directory created with its own `package.json` (no `packages/runner` dependency).
- [ ] HTTP framework chosen (Decision A) and declared as a direct dependency of `apps/api`.
- [ ] `/api/live` route returns `{ ok: true, ts: <ISO timestamp> }` with status 200.
- [ ] HTTP parity test: same status code, same `Content-Type`, same response shape as the current Next.js handler.
- [ ] If Variant Y: cross-process Socket.IO publish smoke test from `apps/api` to `apps/web` Socket.IO server.
- [ ] `apps/api` starts independently (`apps/web` not required for `/api/live`).
- [ ] Architecture test updated: `tests/architecture.test.mjs` must pass with `apps/api` present.
- [ ] `lint:critical` passes with `apps/api/src` added to the lint scope.

### 10.2 CR-ARCH-14 (Realtime extraction)

- [ ] Decision F (transport) confirmed by owner before work begins.
- [ ] Cross-process publish verified: API process emits to a room; a browser client on a separate web replica receives the event (requires integration test with Redis adapter).
- [ ] Worker reconnect verified after deliberate Socket.IO server restart.
- [ ] Session expiry: authenticated socket is disconnected after JWT expiry if revalidation fails.
- [ ] Guest socket is disconnected after 24-hour lifetime.
- [ ] Service token renewal: worker generates a new service token on reconnect.
- [ ] Replica fan-out: two web replicas with Redis adapter; event emitted from one replica reaches clients on both replicas.
- [ ] `tests/integration/realtime.test.mjs` passes.

### 10.3 Verification gates (all implementation issues)

| Gate | Description |
|---|---|
| HTTP parity | Every migrated route returns the same status code, headers, and body shape as its current Next.js counterpart. Verified by contract tests against `docs/architecture/route-inventory.json`. |
| Single URL owner | Each route URL has exactly one authoritative handler (either `apps/web` or `apps/api`), never both. Old handler removed in the same PR as migration. |
| Cross-process publication | After Variant is chosen: `publishPractical()` reaches a browser client whose Socket.IO connection is on a different process than the route handler. |
| Replica fan-out | `io.to(room).emit(event)` on Replica A reaches a client connected to Replica B (requires Redis adapter and integration test). |
| Independent web/API startup | `apps/web` starts and serves pages without `apps/api` running. `apps/api` starts and serves `/api/live` without `apps/web` running. |
| Worker execution round trip | Student submits code → `apps/api` enqueues job → worker processes → `worker_job_complete` emitted → browser receives `job_complete` event → submission saved notification received. |

---

## 11. Reference Links

All URLs accessed 2026-11-03:

- Next.js 16 App Router: https://nextjs.org/docs/app
- Vercel WebSocket limitations: https://vercel.com/docs/functions/limitations
- Fastify v5 documentation: https://fastify.dev/docs/latest/
- Hono documentation: https://hono.dev/docs/
- Express 5 changelog: https://expressjs.com/en/changelog/5x.html
- Socket.IO Redis adapter: https://socket.io/docs/v4/redis-adapter/
- Socket.IO connection state recovery: https://socket.io/docs/v4/connection-state-recovery/
- @socket.io/redis-adapter npm: https://www.npmjs.com/package/@socket.io/redis-adapter
- Fly.io documentation: https://fly.io/docs/
- Node.js cluster module: https://nodejs.org/api/cluster.html

---

## 12. What the Owner Must Do Before Implementation Begins

Fill in every field marked _(blank)_ in this document. The minimum required before CR-ARCH-09 can start:

1. **Decision A** — Choose HTTP framework (Fastify / Hono / Express 5 / other).
2. **Decision B** — Choose origin/gateway strategy (same-origin proxy / separate origins).
3. **Decision C** — Choose hosting topology (VPS / PaaS / mixed / other).
4. **Decision F + C-10** — Choose Variant X or Variant Y for realtime sequencing.

The minimum required before CR-ARCH-14 can start (in addition to the above):

5. **Decision F (transport)** — If Variant Y: specify the cross-process transport for `apps/api` → realtime.
6. **Decision D-3** — Confirm where the Socket.IO server lives (`apps/web`, `apps/api`, or new `apps/realtime`).

Decisions about `vercel.json` files (D-1, D-2) and `cluster.js` fate (D-4) should be recorded but can be deferred until after CR-ARCH-09 is merged and the owner has validated the separate API process.

---

## 13. Checks Run

| Check | Result |
|---|---|
| `git diff --check` | Passed (whitespace clean) |
| `git diff --name-only origin/master` | One file: `docs/architecture/decisions/0001-api-runtime-and-hosting.md` |
| Source file references verified | All paths verified via file reads during branch preparation |
| No secret values in this document | Confirmed — no `.env` values, tokens, or credentials appear |
| Runtime tests | **Not run** — this is a documentation-only PR. No application files were changed; running the test suite would test the unchanged application, not this document. |
| Build | **Not run** — same rationale; application code unchanged. |
| lint:critical | **Not applicable** — `docs/` directory is not in the lint scope defined in `package.json`. |

The existing CI suite (`.github/workflows/architecture-checks.yml`, `.github/workflows/quick-checks.yml`) will run on this PR against the unchanged application code. Any existing CI failures are pre-existing and unrelated to this documentation change; disposition of pre-existing CI failures is at owner discretion.
