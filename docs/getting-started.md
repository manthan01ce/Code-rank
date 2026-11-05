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
  - `REALTIME_URL` (optional explicit worker/internal relay Socket.IO address). Leave it unset to derive `http://127.0.0.1:<API_PORT>`. If an older `.env` contains a fixed port-3000 value, remove/comment it when you want automatic derivation.
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
    DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
    ```
Launcher precedence for PORT, REALTIME_URL, ALLOWED_ORIGIN, API_PORT, API_HOST, INTERNAL_API_URL and public web replica/port settings is: existing process environment → apps/web/.env.local → apps/web/.env → root .env.local → root .env → defaults. A shared Node bridge resolves these settings before either shell launcher applies defaults. It parses values as data, never sources/evaluates .env as shell code, and exports only these launcher settings; unrelated app-local configuration keeps its normal runtime-loading behavior. The canonical infrastructure wrappers use root .env explicitly.

API and worker load their app-local/root backend environment before runtime imports; existing process variables win. Keep shared backend settings in root `.env` or their backend workspace. Do not put database/JWT/admin credentials in `apps/web/.env*`: Next.js loads its own frontend environment files. The host supervisor forwards only public frontend/runtime settings to Next.js. The web artifact needs no database, Redis, JWT, worker token or API origin to build/start.

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

Run the npm infrastructure commands from the repository root after copying/configuring `.env`; the wrappers explicitly use that file. The canonical file is `infrastructure/docker-compose.yml`.

The former root and infrastructure Compose files could create DIFFERENT project-prefixed named volumes. Keeping the YAML keys `redis_data` and `postgres_data` alone does not preserve that identity. The canonical defaults now explicitly use `infrastructure_redis_data` and `infrastructure_postgres_data` for users of the old infrastructure stack.

**Before starting an existing root-Compose installation with the new configuration**, record the running containers' actual mount names (or inspect the old volumes if containers are stopped):

```sh
docker inspect coderank-postgres --format '{{range .Mounts}}{{println .Name .Destination}}{{end}}'
docker inspect coderank-redis --format '{{range .Mounts}}{{println .Name .Destination}}{{end}}'
docker volume ls
```

Set `CODERANK_POSTGRES_VOLUME` and `CODERANK_REDIS_VOLUME` in your root `.env` to those EXISTING names; do not guess a name from the repository folder. Confirm each chosen name exists with `docker volume inspect <actual-name>` before startup. If mounts are bind mounts, the old project uses custom names, or both stacks contain data, stop and reconcile that installation rather than selecting a new empty volume. After startup verify the same mount names and expected records. Never use `down -v`, `volume rm` or pruning as migration/rollback.

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
- **Fresh Volumes**: On the first start of PostgreSQL with an empty data directory, `packages/database/bootstrap/init.sql` automatically populates the schema, 3 courses, 10 practicals, and 91 pre-seeded user accounts.
- **Ledger-Managed Migrations**: For existing databases or after schema changes, run:
  ```sh
  npm run db:migrate
  ```
  *(Readiness checks and health endpoints never run migrations automatically.)*
- **Destructive fixture restore — disposable development databases only**: `db:seed` executes `packages/database/bootstrap/init.sql`, which drops/recreates application tables and the migration ledger. It is NOT an incremental seed or upgrade. Never run it against a lab/production database whose records must be retained. Take a backup and verify the target before any deliberate reset. The command refuses to proceed without the explicit acknowledgement:
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

### Three independent applications and one public infrastructure gateway
1. **Web (`apps/web`)**: frontend pages/features only. Workspace commands use standard `next dev` / `next start`; the Docker image uses framework-generated standalone output.
2. **API (`apps/api`)**: all 47 baseline endpoint groups under `/api`, plus Socket.IO. Private `API_PORT` defaults to 3001 and `API_HOST` to loopback.
3. **Worker (`apps/worker`)**: BullMQ execution/grading orchestration; only this application receives Docker-daemon access.

`infrastructure/gateway` owns the public `PORT` (default 3000). Every `/api/*` and `/socket.io/*` request goes to API; page/static requests go to Next.js. Unknown API URLs receive API's 404 and never fall back to frontend. Host `INTERNAL_API_URL` defaults from API_PORT; container gateway uses `http://api:3001` and `http://web:3000`. The web app itself receives neither address nor backend secrets.

Root `npm run dev` starts API, worker and the web/gateway host supervisor, assuming infrastructure and the runner image are ready. You can also use the three terminals below.

### Terminal 1: API
```sh
npm run api
```

### Terminal 2: Background Worker
```sh
npm run worker
```
*(Runs `node src/index.js` through the worker workspace's dev script. No automatic reload/watch mode is configured; restart after worker code changes.)*

### Terminal 3: Web Platform
```sh
npm run web
```
> Root `npm run web` launches the external gateway and one `next dev` child on an internal loopback port. Internal web ports default to PORT+20, optionally overridden by WEB_INTERNAL_PORT. For production, build web first and use `npm run web:production`; CLUSTER_ENABLED=true and WEB_CONCURRENCY select supervised standard Next.js replicas. Crashed replicas are replaced and shutdown drains the gateway/children. Direct `npm run dev --workspace=apps/web -- --port 3020` starts frontend alone, without API or backend secrets; use the gateway for complete browser workflows.

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

### Warm daemon retirement candidate

Shared warm execution is being retired in #99; Docker acceptance is still blocked.
Before adopting that change, drain old workers, remove `USE_WARM_DAEMONS` from their
environment and remove the old warm overlay from startup configuration. An enabled
legacy flag now fails explicitly instead of silently selecting another execution mode.
Use the existing cold per-job sandbox topology. See the [consumer analysis, operator
migration and required Docker evidence](architecture/warm-daemon-disposition.md).

### Containerized application mode

Use `docker compose --env-file .env -f infrastructure/docker-compose.yml -f infrastructure/compose.containers.yaml --profile local-database up -d --build` after configuring DATABASE_URL with a container-reachable host (`postgres` for the local Compose database). The infrastructure gateway uses `http://api:3001` and `http://web:3000`; worker realtime uses `http://api:3001`. Web receives no backend environment variables. API has no Docker socket. Check existing volume identity before starting this mode.

### Containerized Worker Mode
To run the worker in Docker with host Docker daemon access, first configure its database URL with a hostname reachable FROM the worker container (for local Compose PostgreSQL this is `postgres`, not `localhost`), and its REALTIME_URL with a reachable API host address. Do not reuse a host-only localhost database URL unchanged. The host-run web/worker and container-run worker can require different internal addresses. Start PostgreSQL with the local-database profile if needed before this mode:
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
   - Ensure worker `REALTIME_URL` points to API; browser requests use the web origin and its WebSocket proxy.
   - If overriding ports, ensure `ALLOWED_ORIGIN` includes the client's URL.

## Architecture completion and hosting scope

See [three-app topology](architecture/three-app-topology.md) for ownership, addresses, image checks and release order. The competing Vercel configs are retired: this batch certifies the Linux lab Docker/host topology, not a cloud deployment. External hosting needs a separately approved topology including API/realtime, worker, PostgreSQL, Redis and gateway. Later batches retain frontend decomposition, broader core facade cleanup, database assets, runner/warm-mode consolidation and script/test organization.
