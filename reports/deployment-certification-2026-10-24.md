# Architecture hardening and certification

## Implemented

- Practical content is no longer read or serialized by the unauthenticated coding
  page. The client loads it through a new protected detail endpoint, applying
  active session, student role, cohort and start-time checks. Page metadata is
  generic. The inventory now contains 47 API paths and 64 HTTP handlers.

- Student practical discovery uses descending ID keyset pages: default 25, maximum
  100, optional `cursor`, array response and `X-Next-Cursor`. Dashboard, dedicated
  practical list and coding-workspace selector expose First/Next navigation.
  Realtime refresh retains the current page. Requests are aborted when filters
  change so late responses cannot replace another course's page.
- Practical reports use one PostgreSQL statement snapshot for current actor
  status/session, faculty assignment, cohort, totals, best grades and pagination.
  Default 50 students, maximum 100; `pagination.nextCursor` advances by ID.
  Global totals remain global while grade rows are bounded. Each page is a fresh
  authorized snapshot; pagination is not a frozen export across multiple requests.
  Faculty practical actions include a paginated Grades dialog.
- Administrator statistics read one fresh PostgreSQL statement per request and
  use `Cache-Control: no-store`. This removes the process-local 30-second cache;
  different request times can naturally see different committed data.
- Operational retention previews by default. Apply removes at most 500 old
  workspaces and 500 old logs per batch (hard maximum 1000 each), with an atomic
  retention audit. Defaults are 180 days for drafts and 365 for logs. Fresh drafts,
  academic submissions, grades, attempts and replay protection are preserved.
  Redis terminal-job retention and deployment-scoped expired-container recovery
  already exist and remain enabled.
- Migration 007 adds indexes for retention and keyset pages; the schema checksum
  manifest is updated. Readiness rejects an unupgraded database.
- A separate web container runs as a non-root user without the runner package,
  Docker CLI or Docker socket. Optional Compose web service has a read-only root,
  writable cache/tmp mounts, dropped capabilities and no-new-privileges. Worker
  service no longer has a fixed container name, allowing worker replicas. Use
  dedicated worker hosts for production: a Docker socket is host-level authority.
- Architecture CI runs on `fix/architecture-*` branches and pull requests. It
  builds both deployment images, runs strict unit/integration/Docker tests, builds
  Next.js, performs the real execution round trip and tests two web processes,
  browser roles/privacy, capacity and process/database recovery. Its final step
  writes `test-results/certification.json` only after validating complete evidence
  and matching the exact commit SHA. Missing, skipped, flaky or failed evidence
  prevents a passing certificate.

## Architecture and release compatibility

The system remains a layered modular monolith with a separately deployed worker.
A shared database is intentional; this change does not claim independent
microservice data ownership. The tested deployment unit is one Git commit and its
web/worker images, migration ledger and runner image. Apply forward migrations
through the existing backup/recovery procedure before upgrading the application.
Keep web and worker replicas on that tested release. Restore rehearsals and rollback
plans must accompany schema changes; rolling back only application code does not
roll back the database.

Separating domain databases would be a separate migration involving ownership,
distributed transactions, event delivery and existing grading guarantees. Runtime
web/runner separation and dependency-boundary tests enforce the existing design.

## Retention operation

On the configured database, preview a batch with an explicit database name:

```bash
npm run retention -- --target coderank
```

After reviewing the counts and retaining the required backups, an operator can
apply that policy:

```bash
npm run retention -- --target coderank --apply --workspace-days 180 --log-days 365 --limit 500
```

Run bounded batches from the deployment scheduler; lower batch sizes reduce load.
No production scheduler or deletion was activated by this change. The target must
match `DATABASE_URL`, and the full schema readiness check must succeed. The command
never prints credentials. A failed audit rolls back the deletions. Institutional
record-retention requirements may require longer retention; academic records are
not automatically deleted.

## Certification scope

Local strict verification passes 190 tests with no failures or skips, and critical lint passes before pushing. The production build
cannot complete on this workspace because Node reports
`uv_resident_set_memory: ENOENT`; Docker and standalone Redis/Postgres executables
are unavailable. These restrictions are not bypassed or marked as passing.

GitHub Actions must pass for the exact pushed commit before merge. Download its
`strict-verification-<sha>` artifact and inspect `certification.json` plus the
hashed evidence. This certifies only the CI host, simulated recovery and measured
workload; `productionCertified` is explicitly false.

Before production approval, the operator must run `deployment:check` against the
actual target, run the capacity workload with deployment-specific thresholds,
repeat runner isolation/recovery drills on a dedicated equivalent host, and
verify the real load balancer/replica topology and database recovery process.
CI tests two processes and shared Redis delivery, not the production network or
infrastructure. No production security/capacity certification is asserted here.
