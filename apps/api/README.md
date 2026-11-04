# @coderank/api

Fastify HTTP and Socket.IO API service for CodeRank.

## Architecture and Ownership

- **Runtime**: Fastify v5 on Node.js >=24.
- **Topology**: Serves migrated backend HTTP endpoints behind a same-origin gateway; Socket.IO is authoritative on API.
- **Independence**: Runs independently of Next.js frontend (`apps/web`) and execution orchestrator (`apps/worker`). Contains no React, Next.js, runner or Docker daemon access.
- **Module Structure**: Feature adapters and use cases reside in `src/modules/<feature>/`.

## Network Addresses and Gateway Topology

- **Public Web / Gateway Address**: `http://localhost:3000` (browser clients access pages and `/api/*` endpoints through this single origin).
- **Private API Address**:
  - Host development: `http://127.0.0.1:3001`
  - Container network: `http://api:3001`
- **API configuration**: `API_PORT` defaults to `3001`; `API_HOST` defaults to `127.0.0.1`. The web `PORT` and inherited machine `HOSTNAME` do not select API listening addresses. Containers explicitly set `API_HOST=0.0.0.0`.
- **Gateway**: `infrastructure/gateway` sends every `/api/*` and `/socket.io/*` request to API and pages/static assets to standard Next.js. `INTERNAL_API_URL` is read by gateway at startup, not by web. No API URL remains authoritative on frontend.
- **Failure handling**: unavailable API returns uncached 502; upstream timeout returns uncached 504. Request cancellation closes upstream work. No second web liveness handler hides API outages.

## Endpoint ownership

All **47 baseline endpoint groups** are API-owned. The exact URLs/methods and sources are maintained in `docs/architecture/route-inventory.json`; architecture checks reconcile every registration. Modules are auth, users, courses, mapping, practicals, execution, submissions, operations and username profile. Socket.IO resides in `src/realtime`.

## Development and Host Mode

Run API service locally:

```bash
npm run dev --workspace=@coderank/api
# or using the root alias:
npm run api
```

Build and lint:

```bash
npm run build --workspace=@coderank/api
npm run lint --workspace=@coderank/api
```

The API build command validates every source file, resolves actual imports/plugins and checks route registration without a database or listener. Node runs the source directly; there is no generated bundle.

Auth lifecycle: Fastify close drains HTTP requests, then closes API-owned Redis and database connections. Login and profile loading live in `src/modules/auth/auth.service.js`; reusable authority checks live in `src/middleware/authentication.js`. Shared self-account mutations reside once in API `src/modules/auth/account.service.js`, used by auth, administrative-password and username-profile adapters. JSON/error/method handling is adapted explicitly to preserve the previous HTTP behavior.

Realtime lifecycle: the API's public Fastify publisher is available to feature modules after readiness. Pre-close disconnects only this replica's sockets; closing one API must not disconnect healthy replicas. Namespace/Engine.IO and Redis adapter cleanup is awaited with bounded deadlines. Tests must exit naturally, without forced process success. Lab launchers derive worker REALTIME_URL from API_PORT; container API explicitly receives database, Redis, allowed-origin and adapter configuration.
