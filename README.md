# CodeRank

Educational practical-management and code-execution platform using Next.js,
PostgreSQL/Neon, Redis/BullMQ and Docker.

## Active workspace

- `apps/web`: UI, HTTP adapters and authenticated realtime server.
- `apps/worker`: execution and system queue consumers.
- `packages/core`: domain services and access policy.
- `packages/database`: database client and migration engine.
- `packages/queue`: atomic execution admission.
- `packages/runner`: language execution and disposable sandboxes.
- `database/migrations`: versioned schema and transactional grading.
- `infrastructure`: authoritative Docker image and Compose configuration.

See [architecture](ARCHITECTURE.md), [repair plan](docs/REPAIR_PLAN.md) and
[implementation report](docs/IMPLEMENTATION_REPORT.md). The old `frontend/` and `backend/` copies have been retired. The top-level
`runner/` is a legacy copy; `infrastructure` defines the active sandbox image.

## Local setup

Use Node 24, npm, Docker and a configured Neon database. Copy `.env.example` to
`.env`, provide your database URL and a strong JWT secret. Never commit credentials.

```sh
npm ci
# Review schema/duplicates and back up an existing database before migration.
npm run db:preflight
# Preflight reports missing columns that the pending migrations will add.
npm run db:migrate
docker compose -f infrastructure/docker-compose.yml --profile build-image build runner-image
docker compose -f infrastructure/docker-compose.yml up -d redis
npm run worker
# In another terminal:
npm run web
```

Alternatively use `start-lab.sh` or `start-lab.bat` after configuration and database
migration. The optional local PostgreSQL Compose profile does not replace Neon's
HTTP driver automatically; use a compatible local adapter/proxy if choosing it.

For a containerized worker, build the runner image first, then enable the
`container-worker` profile. Only the trusted worker receives the Docker socket.
Set `REALTIME_URL` to the persistent web/realtime server and configure
`ALLOWED_ORIGIN`. Never expose Redis publicly.

## Verification

The local harness suite requires GCC and Node.js; use Linux/WSL or the included
Ubuntu CI job. Test concurrency is limited to two to bound embedded-database
memory use. It compiles and runs trusted test solutions. Docker tests separately
verify the production execution path.

```sh
npm test
npm run test:redis       # Redis running on REDIS_PORT, default 6379
npm run test:postgres    # isolated TEST_DATABASE_URL required
npm run test:neon        # optional Neon config; uses and removes private test schemas
npm run test:docker      # Docker plus coderank-base:latest required
npm run build --workspace=apps/web
npm run test:stack       # built web app, Docker image and disposable Redis required
npm run deployment:check -- https://your-deployment.example
```

The PostgreSQL integration test creates and drops its own schema; it must still
use a disposable test database. CI runs all these gates. Local mock/PGlite tests
do not replace host-level Docker checks or concurrency/load testing.

## Operational contracts

Execution APIs return `202` with a job ID; clients use authorized polling or
trusted realtime completion. Existing endpoint paths are retained. Hidden tests
are redacted from student-facing results. User and selector lists use cursor pagination;
inspect `X-Next-Cursor` and pass `cursor` to retrieve another page.

Default admission is 500 pending/active jobs globally and five per owner;
configure `MAX_QUEUE_SIZE` and `MAX_JOBS_PER_USER`. Set worker concurrency based on
measured CPU/memory, not student count. Each sandbox has its own bounded lifetime.
`/api/health` requires a healthy worker lease; `/api/live` checks process liveness.
Workers must have access to Docker and the configured sandbox image.
Redis uses AOF and no-eviction mode; provision memory and alert before exhaustion.

For multiple web processes, enable `REALTIME_REDIS_ENABLED=true`, then
`CLUSTER_ENABLED=true` and a bounded `WEB_CONCURRENCY`. Supported socket clients
use WebSocket-only transport; shared delivery is covered by Redis integration tests.
Validate the full production cluster on the deployment host before scaling it.
Database migrations through 006 must precede the new web/worker deployment. Remaining limitations and exact
validation results are recorded in the implementation report; this refactor does
not establish a production capacity guarantee.

`test:stack` starts its own production web and worker processes on loopback port
3100, forces a placeholder database URL, and exercises all five playground
languages through HTTP, Redis and Docker. It checks guest ownership, worker-only
realtime publishing, completion delivery, invalid bearer denial and runtime
failure. It uses the configured Redis instance: use disposable test infrastructure.
Diagnostics are written under `test-results/stack/`. This gate does not validate
student grading or database-backed browser workflows.

`deployment:check` only reads liveness/readiness endpoints. It requires a fresh,
uncached healthy report with database, queue and at least one execution worker.
It does not apply migrations or deploy code.

Readiness also verifies every required migration name and checksum against a
bundled manifest. Missing, pending or modified migration ledgers make
`/api/health` return 503; `/api/live` remains independent of the database. Health
checks never create the ledger or apply migrations. After adding a new migration,
run `npm run db:manifest` and commit its updated metadata; the regression suite
checks that the manifest matches the migration files. This command does not
connect to a database.

`test:redis` includes real child-process worker crash recovery, exhausted stalled
recovery and production graceful-drain tests. Their deliberately shortened leases
are test-only; the production worker lock remains tied to the job lifetime.
Recovery can execute a job again. Transactional submission idempotency prevents
duplicate persisted grades; it is not an exactly-once execution guarantee.

Strict CI runs `npm run lint:critical`, `npm test`, `npm run test:integration` and
`npm run test:docker`. Test modes reject skipped, TODO, empty, filtered and
incomplete runs; TAP evidence is saved under `test-results/`.
`test:authenticated` additionally requires Docker, Chromium installed with
`npx playwright install --with-deps chromium`, Redis and a loopback
`TEST_DATABASE_URL` naming a disposable `*_test` database with CREATE DATABASE
permission. It creates/drops a separate database, runs migrations and checks a
two-process production cluster plus admin/faculty/student browser workflows.
It binds port 3101. Use disposable Redis infrastructure for this gate.

Neon remains the default database transport. Set `DATABASE_DRIVER=postgres` only
for a standard PostgreSQL TCP connection; `DB_POOL_SIZE` bounds connections per
process (1–50), so account for every web and worker process when sizing the
server's connection budget. Query timeouts use `DB_QUERY_TIMEOUT_MS` (1–120000 ms
for this transport). Changing the driver does not apply migrations.
