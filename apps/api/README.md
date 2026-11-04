# @coderank/api

Fastify HTTP API service (Socket.IO migration is pending 3C) for CodeRank.

## Architecture and Ownership

- **Runtime**: Fastify v5 on Node.js >=24.
- **Topology**: Serves backend HTTP endpoints and Socket.IO realtime connections behind a same-origin gateway.
- **Independence**: Runs independently of Next.js frontend (`apps/web`) and execution orchestrator (`apps/worker`). Contains no React, Next.js, runner or Docker daemon access.
- **Module Structure**: Feature adapters and use cases reside in `src/modules/<feature>/`.

## Network Addresses and Gateway Topology

- **Public Web / Gateway Address**: `http://localhost:3000` (browser clients access pages and `/api/*` endpoints through this single origin).
- **Private API Address**:
  - Host development: `http://127.0.0.1:3001`
  - Container network: `http://api:3001`
- **API configuration**: `API_PORT` defaults to `3001`; `API_HOST` defaults to `127.0.0.1`. The web `PORT` and inherited machine `HOSTNAME` do not select API listening addresses. Containers explicitly set `API_HOST=0.0.0.0`.
- **Gateway**: the current web custom server forwards exactly `/api/live` (including query strings) using `src/lib/api-gateway.js`. `INTERNAL_API_URL` is read at web process startup, defaults to `http://127.0.0.1:3001`, and must be an HTTP(S) origin. Container web uses `http://api:3001`. Changing it requires restarting web, not rebuilding. All other HTTP paths and Socket.IO stay on web until their slices migrate.
- **Failure handling**: unavailable API returns uncached 502; upstream timeout returns uncached 504. Request cancellation closes upstream work. No second web liveness handler hides API outages.

## Migrated Endpoints

| URL | Method | Module | Migration Slice |
| --- | --- | --- | --- |
| `/api/live` | GET | `operations` | CR-ARCH-09 (Issue 3A / #49) |

All other 46 endpoints remain authoritative on `apps/web` until their respective migration slices.

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
