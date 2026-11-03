# Getting Started with CodeRank

This is the authoritative developer setup and onboarding guide for the CodeRank repository.

---

## 1. Prerequisites & Required Toolchains

Ensure your development environment meets the following specifications:
- **Node.js**: `v24.0.0` or higher (CI uses Node 24; see `package.json` `"engines": { "node": ">=24.0.0" }`).
- **npm**: use the repository-declared `npm@11.11.0` (`packageManager` in `package.json`).
- **Docker**: Docker Engine 24+ / Docker Desktop (with Docker Compose v2+ / `docker compose`).
- **Operating Systems Supported**: Linux (Ubuntu 22.04+ / Debian 12+) or Windows (PowerShell 7+ / CMD) with Docker. Note: Production lab deployments target Linux hosts with native Docker daemon access.

---

## 2. Environment Setup

Copy the environment template:
```sh
cp .env.example .env
```

Review and adjust variables in `.env`:
- **Server Ports**:
  - `PORT=3000` (documented default port; launcher scripts and runtime inherit this override).
  - `REALTIME_URL` (optional explicit worker/internal relay Socket.IO address). Leave it unset to derive `http://127.0.0.1:<PORT>`. If an older `.env` contains a fixed port-3000 value, remove/comment it when you want automatic derivation.
  - `ALLOWED_ORIGIN` (optional comma-separated browser origins for CORS). Launchers derive localhost and detected LAN origins from the effective port when it is unset.
  - `NEXT_PUBLIC_REALTIME_URL` (optional separate browser realtime origin; leave commented out for same-origin). Note: this is a Next.js build-time variable; changing it requires rebuilding the web bundle.
- **Database**:
  - For local Docker PostgreSQL (recommended for local development):
    ```env
    DATABASE_DRIVER=postgres
    DATABASE_URL=postgresql://postgres:postgres@localhost:5432/coderank_local?sslmode=disable
    TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/coderank_test?sslmode=disable
    ```
  - For Neon Serverless Postgres:
    ```env
    DATABASE_DRIVER=neon
    DATABASE_URL=postgresql://<user>:<password>@<endpoint>.neon.tech/neondb?sslmode=require&pgbouncer=true
    ```
Launcher precedence for PORT, REALTIME_URL and ALLOWED_ORIGIN is: existing process environment → apps/web/.env.local → apps/web/.env → root .env.local → root .env → defaults. A shared Node bridge resolves these settings before either shell launcher applies defaults. It parses values as data, never sources/evaluates .env as shell code, and exports only these launcher settings; unrelated app-local configuration keeps its normal runtime-loading behavior. The canonical infrastructure wrappers use root .env explicitly.

For direct `npm run web` / `npm run worker`, each workspace retains its existing dotenv loader. Keep shared lab settings in root .env; do not configure contradictory per-app port/realtime values.

- **JWT Secret**:
  - `JWT_SECRET=your_super_secret_jwt_key_here` (must be non-empty).

---

## 3. Dependency Installation

Install workspace dependencies from the repository root:
```sh
npm ci
```

---

## 4. Starting Infrastructure (Database & Redis)

CodeRank uses `infrastructure/docker-compose.yml` as the authoritative Compose configuration.

### Existing installations: protect the existing data volume

Before `infra:up`, follow the [existing-installation volume mapping procedure](../README.md#existing-installations-preserve-the-actual-volume-identity). The retired root Compose file and the infrastructure file could use different project-prefixed volumes; identical YAML keys do not guarantee the same data.

Inspect the old PostgreSQL/Redis containers' mount names (or existing volumes if containers are stopped), set `CODERANK_POSTGRES_VOLUME` and `CODERANK_REDIS_VOLUME` in root .env to the actual names, and verify them with `docker volume inspect <actual-name>`. Do not guess or create an empty volume as a substitute. Stop and reconcile installations using bind mounts or multiple populated stacks. After startup, verify the same mounts and expected records.

Never remove/prune volumes or reset the database as a folder-migration rollback.

### Start Canonical Local Infrastructure
To start PostgreSQL and Redis in the background:
```sh
npm run infra:up
```
*Behind the scenes, this executes:*
```sh
docker compose --env-file .env -f infrastructure/docker-compose.yml --profile local-database up -d
```

### Initial Data & Schema
- **Fresh Volumes**: On the first start of PostgreSQL with an empty data directory, `database/init.sql` automatically populates the schema, 3 courses, 10 practicals, and 91 pre-seeded user accounts.
- **Ledger-Managed Migrations**: For existing databases or after schema changes, run:
  ```sh
  npm run db:migrate
  ```
  *(Readiness checks and health endpoints never run migrations automatically.)*
- **Destructive fixture restore — disposable development databases only**: `db:seed` executes `database/init.sql`, which drops/recreates application tables and the migration ledger. It is NOT an incremental seed or upgrade. Never run it against a lab/production database whose records must be retained. Take a backup and verify the target before any deliberate reset. The command refuses to proceed without the explicit acknowledgement:
  ```sh
  npm run db:seed -- --allow-destructive-reset
  ```
  Normal existing-database upgrades use `npm run db:migrate`, not `db:seed`. No reset is needed merely because folders or Compose files moved.

### Stop Infrastructure (Preserving Volumes)
To stop infrastructure containers without deleting database data:
```sh
npm run infra:down
```
> **Warning**: Do not use `down -v`, `volume rm` or `docker volume prune` during this migration. These can delete database/queue data; stopping services should preserve volumes.

---

## 5. Building the Sandbox Runner Image

Build the isolated execution container image (`coderank-base:latest`) used for running student code:
```sh
npm run infra:build:sandbox
```
*Behind the scenes, this executes:*
```sh
docker compose --env-file .env -f infrastructure/docker-compose.yml --profile build-image build runner-image
```

---

## 6. Running the Applications

### Current Runtime Architecture (Two Deployable Apps)
The platform currently consists of:
1. **Web Platform (`apps/web`)**: Next.js frontend UI, HTTP API routes, and Socket.IO realtime server running on port `3000`.
2. **Background Execution Worker (`apps/worker`)**: BullMQ consumer processing code execution jobs with Docker sandboxes.

*(Note: The target three-app architecture with a separate `apps/api` Fastify service is planned under the accepted ADR-0001 / CR-ARCH-09+, but not yet active.)*

### Terminal 1: Background Worker
```sh
npm run worker
```
*(Runs `node src/index.js` through the worker workspace's dev script. No automatic reload/watch mode is configured; restart after worker code changes.)*

### Terminal 2: Web Platform
```sh
npm run web
```
> **Note**: root `npm run web` invokes the web workspace's dev script, `node server.js`. This custom server starts Next.js in development mode and hosts the current HTTP/Socket.IO responsibilities. It is not the `next dev` CLI command. The web workspace's production start script is `node cluster.js`.

Open [http://localhost:3000](http://localhost:3000) for the default port, or use the effective PORT shown by the launcher.

---

## 7. Development fixture accounts

The bootstrap snapshot includes development accounts, but it is not evidence of the current credentials on an existing lab database. Passwords and account status may have changed. Obtain the configured credentials from the lab administrator or use the application's authorized password-reset workflow. Do not restore the entire database to recover one account.

---

## 8. Health Checks & Verification

Verify platform operational status using the health endpoints:
- **Process Liveness**:
  ```sh
  curl -s http://localhost:3000/api/live
  ```
  Returns: `{"status":"ok","timestamp":"..."}` with HTTP 200 and `Cache-Control: no-store`.
- **System Readiness**:
  ```sh
  curl -s http://localhost:3000/api/health
  ```
  Verifies database connection pool, Redis connectivity, migration ledger integrity, and active worker heartbeat.

---

## 9. Alternative Runtime Modes

### Warm Daemons Mode (Local Development Only)
For faster local interactive development, long-running language containers can be started via the warm overlay:
```sh
docker compose --env-file .env -f infrastructure/docker-compose.yml -f infrastructure/compose.warm-daemons.yaml --profile local-database up -d
```
And set `USE_WARM_DAEMONS=true` in the worker process environment.
> **Security Warning**: Warm daemons reuse long-running containers per language (`coderank-<lang>-daemon`) for lower latency. They **do not** provide per-job filesystem or process isolation; do not use warm daemons for untrusted multi-tenant execution.

### Containerized Worker Mode
To run the worker in Docker with host Docker daemon access, first configure its database URL with a hostname reachable FROM the worker container (for local Compose PostgreSQL this is `postgres`, not `localhost`), and its REALTIME_URL with a reachable web host address. Do not reuse a host-only localhost database URL unchanged. The host-run web/worker and container-run worker can require different internal addresses. Start PostgreSQL with the local-database profile if needed before this mode:
```sh
docker compose --env-file .env -f infrastructure/docker-compose.yml --profile container-worker up -d
```

---

## 10. Automated Testing & Quality Checks

Run the project verification commands:
```sh
npm run lint:critical    # Critical path ESLint checks
npm test                 # Strict unit suite; count comes from current TAP results
npm run test:docker      # Docker runner sandbox isolation tests
npm run test:redis       # Redis queue, realtime, and recovery tests (requires Redis)
npm run test:postgres    # PostgreSQL schema tests (requires TEST_DATABASE_URL)
npm run test:stack       # Full web-to-worker stack test on loopback port 3100
```

---

## 11. Troubleshooting Common Issues

1. **Docker Container Name Conflicts**:
   - Error: `Conflict. The container name "/coderank-redis" is already in use...`
   - Inspect container ownership and mount names first. Follow the existing-volume procedure above, stop the old stack deliberately, then start the canonical stack with the same volumes. Do not blindly force-remove containers or delete volumes.
2. **Missing Sandbox Image**:
   - Submissions fail with "Execution failed internally" or "image not found".
   - Solution: Run `npm run infra:build:sandbox` to compile `coderank-base:latest`.
3. **Database Migration Failures**:
   - Check that `DATABASE_URL` in `.env` is reachable.
   - Run `npm run db:migrate` as the explicit upgrade step, then `npm run db:preflight` to confirm readiness. Do not use the destructive fixture restore to resolve a migration error.
4. **WebSocket Disconnections**:
   - Ensure `PORT` and `REALTIME_URL` in `.env` match.
   - If overriding ports, ensure `ALLOWED_ORIGIN` includes the client's URL.
