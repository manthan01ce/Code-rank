# Getting Started with CodeRank

This is the authoritative developer setup and onboarding guide for the CodeRank repository.

---

## 1. Prerequisites & Required Toolchains

Ensure your development environment meets the following specifications:
- **Node.js**: `v24.0.0` or higher (verified on Node 24 and Node 25; see `package.json` `"engines": { "node": ">=24.0.0" }`).
- **npm**: `v11.0.0` or higher (tested with npm 11).
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
  - `REALTIME_URL=http://127.0.0.1:3000` (worker/internal relay Socket.IO address; derived from `PORT` if left unset).
  - `ALLOWED_ORIGIN=http://localhost:3000` (comma-separated browser origins for CORS).
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
- **Optional Re-seeding**:
  ```sh
  npm run db:seed
  ```

### Stop Infrastructure (Preserving Volumes)
To stop infrastructure containers without deleting database data:
```sh
npm run infra:down
```
> **Warning**: Never use `down -v` or `docker volume prune` unless you intentionally want to delete all local database and queue records.

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
*(Starts the BullMQ worker in development mode with live reload).*

### Terminal 2: Web Platform
```sh
npm run web
```
> **Note**: `npm run web` starts the Next.js development server (`next dev`). It does **not** launch the production clustered mode (`apps/web/cluster.js`), which is reserved for production environments.

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 7. Pre-Seeded Test Credentials

All pre-seeded test accounts use the password `LoadTest@2024` (or fallback `adminpassword123`):

| Role | Email | Password | Scope |
|---|---|---|---|
| **Admin** | `admin@example.com` | `adminpassword123` | System settings, user/course administration |
| **Faculty** | `hardi.agola@charusat.ac.in` | `LoadTest@2024` | Course coordinator, practical creation, grade inspection |
| **Student** | `26ce001@charusat.edu.in` | `LoadTest@2024` | Lab practicals, code workspace, code execution |
| **Student** | `26ce002@charusat.edu.in` ... `26ce074@charusat.edu.in` | `LoadTest@2024` | 73 additional pre-configured student accounts |

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
To run the worker in Docker with host Docker daemon access:
```sh
docker compose --env-file .env -f infrastructure/docker-compose.yml --profile container-worker up -d
```

---

## 10. Automated Testing & Quality Checks

Run the project verification commands:
```sh
npm run lint:critical    # Critical path ESLint checks
npm test                 # Unit test suite (193 tests)
npm run test:docker      # Docker runner sandbox isolation tests
npm run test:redis       # Redis queue, realtime, and recovery tests (requires Redis)
npm run test:postgres    # PostgreSQL schema tests (requires TEST_DATABASE_URL)
npm run test:stack       # Full web-to-worker stack test on loopback port 3100
```

---

## 11. Troubleshooting Common Issues

1. **Docker Container Name Conflicts**:
   - Error: `Conflict. The container name "/coderank-redis" is already in use...`
   - Solution: Stop and remove previous conflicting containers using `docker rm -f coderank-redis coderank-postgres` (or run `npm run infra:down` first). Do not delete data volumes.
2. **Missing Sandbox Image**:
   - Submissions fail with "Execution failed internally" or "image not found".
   - Solution: Run `npm run infra:build:sandbox` to compile `coderank-base:latest`.
3. **Database Migration Failures**:
   - Check that `DATABASE_URL` in `.env` is reachable.
   - Run `npm run db:preflight` followed by `npm run db:migrate`.
4. **WebSocket Disconnections**:
   - Ensure `PORT` and `REALTIME_URL` in `.env` match.
   - If overriding ports, ensure `ALLOWED_ORIGIN` includes the client's URL.
