# @coderank/api

Fastify HTTP and Socket.IO API service for CodeRank.

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
- **Port Resolution Precedence**:
  1. `API_PORT` (explicit port for API runtime, prevents conflict with web's `PORT`)
  2. `PORT` (fallback environment variable, standard in container runtimes)
  3. `3001` (default fallback)

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
