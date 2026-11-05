# Deployment, capacity and recovery

These tools are implemented and exercised on disposable CI infrastructure.
They do not automatically select a public deployment or migrate the Neon database.
Use a deployment-specific SANDBOX_SCOPE consistently across worker replicas and
recovery commands. Existing API paths and response contracts are preserved.

## Back up, rehearse and migrate

Use a maintenance host with the checked-out release, Node 24, Docker and matching
pg_dump/pg_restore tools. Their major versions must match each other and support
the source PostgreSQL version. The local restore server must support that archive
and permit CREATE DATABASE. Set PG_DUMP_BIN/PG_RESTORE_BIN when needed.

Configure DATABASE_URL as the intended database's **direct** connection in the
host's secret environment. The previously supplied Neon pooler URL is unsuitable
for exported snapshots and session locks; use its direct counterpart. Configure
RESTORE_ADMIN_DATABASE_URL for a disposable loopback database ending in _test.
Credentials are passed to PostgreSQL tools through environment, not command-line
arguments or evidence. Production archives contain sensitive application data:
keep the evidence directory on private persistent storage and copy it to your
approved encrypted backup destination. Never upload production archives to public
CI artifacts. The tool does not configure offsite retention or encryption.

First rehearse without applying migrations to the source:

```sh
npm run db:operations -- --target db.example:5432/coderank --output /private/backups/release-verify --mode verify
```

The exact target must match DATABASE_URL's host:port/database. Output must be a
new directory; parents must exist. Verification holds an exported snapshot while
counting public tables and creating a custom-format archive, checks SHA256 and
archive readability, restores into a randomly named local database in one
transaction, compares restored table counts, and rehearses all migrations there.
The local database is dropped; backup.dump and manifest.json remain private.
This is a database/data backup, not a backup of provider settings, roles or grants.
Provision those independently for a disaster restore.

Before source migrations, stop application writers and drain execution work using
the deployment's process manager. Allow at least the configured job lifetime and
worker drain deadline; do not accept new submissions during this maintenance.
Keep the previous release available. Then use a new persistent output directory:

```sh
npm run db:operations -- --target db.example:5432/coderank --output /private/backups/release-apply --mode migrate --maintenance-confirmed
```

The flag asserts the operator has stopped writers; it does not stop remote apps.
A failed backup, restore or rehearsal prevents source migration. Migrations are
transactional individually, not one transaction across every file: if a later
file fails, earlier applied files remain recorded. Leave writers stopped, inspect
the failedStage and ledger, and use a reviewed forward fix or restore/cutover.
Never edit an already recorded migration checksum. CLI errors deliberately omit
SQL/credentials; inspect sanitized evidence and restricted database logs.

Start the intended release's web and worker processes with the same JWT_SECRET,
Redis configuration and DATABASE_URL. Native TCP transport needs
DATABASE_DRIVER=postgres; Neon HTTP remains the default. Account for DB_POOL_SIZE
per process across all web and execution replicas. Restore verification does not
create production users/grants, switch application URLs or overwrite live data.
For disaster recovery, restore into a separate provisioned database, verify data,
run the release migrations, check roles/grants, then deliberately switch the app
connection and verify readiness before reopening traffic.

```sh
npm run deployment:check -- https://deployment.example
```

Readiness must be fresh and uncached, with schema checksums, Redis and execution
workers healthy. A green Vercel build alone does not establish worker readiness.

## Measured capacity

Run against the intended staging/deployment origin with an agreed workload and a
dedicated test user. JWT_TOKEN is read from environment and never reported. This
workload executes actual Python code through HTTP, Redis, worker and Docker. It
uses the playground endpoint and does not save student grades. Anonymous sessions
have separate ownership cookies but share the anonymous rate-limit allowance.
Keep normal rate limits enabled; a 429 is a failed capacity gate, not successful
throughput. Use multiple appropriate authenticated test accounts for larger tests;
this single-token smoke does not simulate an entire student population.

```sh
BASE_URL=https://deployment.example CAPACITY_JOBS=12 CAPACITY_CONCURRENCY=2 CAPACITY_DURATION_MS=60000 CAPACITY_P95_MS=15000 CAPACITY_MIN_RPS=0.1 npm run test:capacity
```

The JSON report measures completed jobs/s and p50/p95/max end-to-end latency. Every
requested job must finish with success, exit code zero and exact expected output.
Readiness, authentication, admission, polling, output, rate-limit, deadline and
threshold failures fail the command. Start small, record target resources and
worker concurrency, then raise the agreed load within configured limits. CI's
12-job, concurrency-two thresholds are regression gates, not production sizing.
Do not extrapolate a production guarantee from a shared GitHub runner.

## Process and sandbox recovery

CI's authenticated stack kills a cluster web process and requires its replacement
while retaining the rotated user session. It also kills the execution process,
queues a real grading job while the process is absent, restarts it, and requires
the same job's accepted result, one attempt row and one best-grade row. Recovery
latencies and measured capacity are saved under test-results/authenticated/.
Separate real Redis tests cover stalled in-flight retries and exhausted recovery.
At-least-once execution remains the contract; SQL idempotency prevents duplicate
persisted attempt identities.

Every new sandbox carries version, scope, owner and bounded lifetime labels. The
worker starts a bounded reaper immediately and every 30 seconds. It waits beyond
both the recorded deadline and Docker start time plus lifetime and five-second
grace. Names alone never establish ownership. Legacy, malformed and other-scope
containers remain untouched. Inspect and then apply scoped recovery manually:

```sh
npm run runner:reap -- --scope production-coderank
npm run runner:reap -- --scope production-coderank --apply
```

The Docker recovery drill kills an owner process and freezes an expiring sandbox,
then proves scoped cleanup while a live sandbox and an expired different-scope
sandbox survive. This simulates failure of both owner cleanup and the container's
own lifetime supervisor. Run these destructive drills only on disposable or
explicitly designated maintenance infrastructure.

## Complete reproducible gate

`npm run test:authenticated` requires built web output, sandbox image, Docker,
Redis, Chromium, pg_dump/pg_restore and a loopback TEST_DATABASE_URL ending in
_test with CREATE DATABASE permission. It creates its own database and processes;
never point it at production. It checks migrations, all three browser roles,
privacy, session rotation, grading, process recovery, measured execution and a
real backup/restore/migration rehearsal of the resulting database. CI also runs
strict unit, Redis/PostgreSQL, Docker, build and guest five-language checks.
Production execution still requires the intended origin, a direct database URL,
maintenance access and an approved persistent backup destination.
