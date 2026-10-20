# Architecture repair implementation report

Branch: `fix/architecture-hardening`. Baseline: `f476fdc`.
The repair branch is published to GitHub. Historical publication blockers below were resolved on 2026-10-20. No migration has been applied to the application schema.

## Implemented across the repair increments

- Shared execution authorization and validation, protected job ownership and
  anonymous cookies, hidden-case redaction, authenticated realtime rooms and
  separately scoped worker service tokens.
- Bounded polling and worker shutdown; web-side direct execution copies removed.
- Domain folders for users, courses, practicals and submissions. Compatibility
  service exports preserve callers. Separate database, queue and runner packages.
- Versioned, checksummed, transactional migrations. Explicit statement markers
  preserve function bodies and comments. A complete empty-database baseline is
  included. Duplicate historic grades stop migration rather than being deleted.
- Atomic attempt/best-grade/case persistence, unique student/practical grades,
  retry idempotency, Unicode BYTEA storage, deletion/reset coordination, enqueue
  time lateness, correct zero-mark test outcomes and propagated database failures.
- Atomic Redis capacity checks plus insertion and per-owner pending-job caps.
  Producer/worker crash recovery remains BullMQ's responsibility; completed
  grading attempts are replay-safe. The BullMQ script dependency is pinned.
- Per-job disposable Docker containers replace shared language daemons. Resource
  limits, no network, read-only root, private tmpfs, non-root UID, hard lifetime,
  timeout cleanup and infrastructure-error propagation are implemented.
- Workspace routes now delegate to shared validation/access services. User lists
  have bounded cursor pagination and management-page navigation. Redis outage
  no longer disables login/execution rate limits; rejected attempts do not grow
  the limiter's sorted set indefinitely.
- Launchers build the runner image and start Redis. Worker image copies all new
  packages. CI contains Redis, PostgreSQL, Docker and production-build gates.

## Third increment

- Practical create/update/archive/extension and course/faculty mapping now use
  domain services and transactional SQL functions. Authorization is checked inside
  each write transaction. Changes and audit entries commit together.
- Graded test-case replacement is rejected; identical cases can accompany metadata
  edits. Practical deletion now archives even ungraded practicals, preserving case
  and attempt history. Grading takes a shared practical-row lock to coordinate with
  edits/archival. No new public route was introduced.
- Faculty practical lists and submission histories are bounded. Faculty histories
  use opaque keyset cursors with deterministic sort ties and timestamp precision.
  Faculty submission tables navigate pages, and practical selectors follow pages.
- C and JavaScript function harnesses support the ten static catalog problems,
  with matching starter code. Twenty actual GCC/Node harness tests run catalog
  cases; these are trusted test programs on the host, not Docker isolation tests.
- An opt-in Redis Socket.IO adapter and bounded cluster launcher are implemented.
  Supported browser/worker/API socket clients use WebSocket-only transport.
  Cross-server room authorization, completion delivery and redaction passed with
  two independent Socket.IO servers connected to real Redis.
- Fixed the student practical history caller to use its student endpoint; it
  previously called the faculty-only route and received unauthorized responses.
- See ROUTE_CONTRACTS.md for retained paths and intentional behavior changes.

## Fourth increment and supplied Neon environment

- Configured the supplied database URL only in ignored local configuration;
  retained generated local auth secrets and enabled rate limits. Credential scan
  found no database password in source files.
- Read-only application-schema preflight found five grades, no duplicate grade or
  workspace groups, no migration ledger, and a missing `practicals.updated_at`.
  Migration 004 adds the missing column for existing deployments. An upgrade test
  simulates the deployed definitions rather than relying only on a fresh schema.
- User creation/update/deactivation now share a transactional domain service.
  Faculty removal, replacement coordinator, course assignment and audit updates
  commit or roll back together. Remapping uses the same management lock.
- Both user route variants delegate to the service. Bulk imports commit each valid
  row with its audit entry, preserve partial-success reporting, reject invalid
  roles/files and files over 5 MB or 500 rows, and do not expose raw database errors.
- Configured fallback-admin login now creates a persistent admin identity when
  needed; it no longer issues an ID-0 session. Login session/audit writes are atomic,
  and a database outage cannot produce an offline admin session.
- Course marks reports use one authorized SQL snapshot for active students and paginate both students
  and practical columns. UI navigation and department filtering use those pages;
  CSV export explicitly exports the current page. Grade lookup avoids repeated
  linear scans in every matrix cell.
- Profile history requires authentication, returns at most 100 metadata rows,
  and excludes source code and private grading fields. Handles no longer interpret
  `_` as a wildcard. SQL privacy and bulk-upload regressions pass.
- Application migrations have NOT been applied to the public Neon schema. Isolated
  test schemas were removed after testing. The previous-stage read-only check confirmed five
  application grades, no application migration ledger, and zero temporary schemas.
  Deploy only after backing up application
  data and draining old workers; the new code requires migrations through 006.

## Verification

- Full local suite: 125 tests with bounded concurrency (2), including API authorization, route/import invariants,
  grading, PGlite SQL transactions/migration rollback, pagination and sandbox
  command/lifecycle behavior.
- Real Redis 7.2.7: concurrent admission test passed with four producers and 40
  requests; global/per-owner limits, completed-slot reuse and paused admission.
- Embedded PostgreSQL (PGlite): migrations, checksum protection, duplicate-data
  abort/rollback, idempotency, best grades, Unicode, case validation and resets.
- Latest focused ESLint: zero errors; seven warnings in the files checked.
- Production build: blocked by environment error `ENOENT: uv_resident_set_memory`.
- Real Neon integration: two tests passed using user-supplied configuration: concurrent
  grade persistence, transactional admin changes and deactivation/remapping races
  in a disposable schema, plus upgrade validation on copied deployed columns,
  defaults and indexes with private sequences. Copied-table tests do not reproduce
  foreign keys; fresh-schema tests include the baseline foreign keys.
- Actual Docker execution remains unverified here. Docker is unavailable; CI
  contains the five-language and isolation checks. The native PostgreSQL binary
  could not start locally because filesystem ownership changes are unsupported;
  Neon supplied the real database concurrency validation instead.
- Windows launcher and browser-level pagination flows have not been exercised.

## Deployment sequence and open work

1. Back up the database. Inspect deployed schema and duplicates before migration.
   Index creation is transactional and may block writes; schedule a maintenance
   window for a large existing database. Never auto-delete duplicate grades.
2. Stop intake and drain old workers. Apply `npm run db:migrate` using the intended
   Neon database, build the sandbox image, and deploy web/worker together. The
   new web/worker requires migrations through 006; it must not run against the old schema.
3. Require CI's real PostgreSQL concurrency, Docker five-language/isolation, and
   production-build checks. Exercise student/faculty workflows and crash/retry
   behavior, then repeat load tests on the target runner hosts.
4. Remaining rollout work: legacy directory retirement after deployment parity,
   full production-cluster/browser workflows, and target-host load tests.
5. Define attempt/audit retention and monitor queue depth, rejection rate, worker
   stalls, database latency and sandbox failures before scaling traffic.

Rollback requires draining new workers and restoring a compatible application
version; preserve attempt records and the migration ledger. Never edit an applied
migration to roll back a production database.

## Fifth increment: parallel repair stages

- Course/department mutations and audits now share a database transaction;
  referenced departments and courses containing practicals cannot be deleted.
- Selector routes use bounded cursor pages, and all first-party selectors follow
  those pages. Existing route paths and HTTP methods remain covered by fixtures.
- Worker readiness checks include Docker/image availability; shutdown has one
  deadline covering pause and drain. Finished queue-owner indexes are swept
  without weakening pending-job admission limits.
- HTTP and realtime authentication recheck current accounts and sessions. Socket
  membership is periodically revalidated and bounded. Password changes rotate
  sessions atomically and all three UI consumers store the replacement token.
- Submission reset verifies current faculty mapping inside the reset/audit
  transaction. Migration error reporting preserves the original SQL failure.
- Fixed the shared grading-service package export that blocked worker imports.

Real Redis admission, cross-server realtime and worker-readiness tests passed.
Actual Docker isolation and the production build remain mandatory deployment
gates; Docker is unavailable here and Next build fails with the environment error
`ENOENT: uv_resident_set_memory`. Public database migrations remain unapplied.

Final browser authentication review corrected guest sockets sending a null bearer
credential. Connection attempts now read the current stored token; a regression
test covers guest credentials and session rotation. The final local suite passes
121 tests, with no skipped tests.

Final Neon validation: the copied deployed-definition upgrade passed (262 seconds),
and the fresh-schema concurrency/administration test passed (327 seconds), both
including migrations 005 and 006. The fresh-schema run initially exceeded its
five-minute overall deadline; it passed after extending that deadline to eight
minutes while retaining individual request timeouts. These tests do not apply
migrations to the public application schema.

## GitHub synchronization and CI reconciliation

Merged the newer remote architecture branch before publication. Preserved upstream
login/hydration fixes and legacy-directory retirement. The newer shared execution,
authorization and sandbox contracts supersede the remote branch's older duplicate
implementations and four old test files; their behavior is covered by the active
121-test suite. The legacy migration command delegates to the ledger-based CLI.
JWT secret lookup remains lazy for build imports, with no fallback signing key.

Consolidated CI into Architecture checks using Node 24, strict npm ci, all local
tests, real Redis/PostgreSQL, actual Docker execution/isolation, and Next build.
The workflow runs for working-branch pushes and pull requests, with bounded run
time and read-only repository permissions. Local pre-push tests: 121 passed; real
Redis: three passed. Local production build remains environment-blocked.

## Next validation stages

- Added a full production web-to-worker smoke gate: actual HTTP guest cookie,
  Redis admission, five-language Docker execution, Socket.IO worker publication,
  job polling/ownership denial and runtime-error handling. CI also validates the
  authoritative Compose file and builds the worker deployment image.
- Added `deployment:check`, a read-only liveness/readiness gate that rejects stale
  or cacheable reports, redirects, dependency failures and missing workers.
  A real loopback HTTP regression test covers these failures.
- Fixed execution load measurements so queue completion alone is insufficient:
  successful process status, zero exit code and exact expected output are required.
  Admission, polling and execution errors are recorded separately. The stress
  scenario shares this contract instead of treating failed jobs as successes.

The lockfile passes strict offline npm-ci dry-run validation. Workflow YAML and
working-branch triggers validate. Local full-stack invocation fails at its Docker
preflight because Docker is unavailable; k6 target-host execution and the new
GitHub CI run remain unverified.

Publication blocker: command-line Git has no credentials, and the connected GitHub
app rejects Git-tree creation with HTTP 403 (Resource not accessible by integration).
Its installation is for tatvam-org; publishing to manthan01ce/Code-rank needs an
authorized connection for that repository. No remote branch was changed.

Final next-stage local verification: 123 tests passed, zero failures/skips;
strict lockfile dry-run, workflow YAML/trigger checks and diff whitespace checks
passed. New Docker full-stack and target-host k6 checks remain unrun.

Docker build context now excludes environment files, dependency/build caches,
execution storage, logs and test artifacts.

## Worker recovery and schema-readiness stage

- Added real Redis integration tests that kill worker child processes. Recovery
  retains the original job identity, keeps owner quota reserved while nonterminal,
  releases it after completion/failure and bounds repeated stalled recovery.
- Exercised the production shutdown coordinator against an active real BullMQ
  job. It drains that job without taking queued work; repeated calls share one
  shutdown promise. All six Redis integration cases passed.
- Added a read-only migration/checksum readiness check. Missing ledgers, pending
  migrations and mismatched checksums return degraded readiness rather than a
  false healthy SELECT-1 result. The checked-in JSON manifest is bundle-safe and
  verified against all migration files. `db:manifest` updates metadata without
  connecting to a database.
- A read-only check of the configured Neon database returned schema=missing. No
  application migrations or writes were performed. Focused health/schema tests
  passed; health-route lint reported zero errors/warnings.
- Recovery establishes at-least-once processing. Existing SQL attempt idempotency
  prevents duplicate persisted grades; these Redis tests do not establish exactly-
  once execution or prove Docker orphan-container cleanup.

GitHub publication still requires repository authorization for the intended
account. Docker, production build, browser and target-host capacity gates remain
open; no new remote CI run is claimed.

Final verification for this stage: 125 local tests passed with no skips/failures;
six real Redis integration tests passed; focused health-route lint had zero
errors/warnings. Lockfile dry-run, workflow registration and whitespace checks
passed. The root test command now has a 30-second test timeout.

## GitHub publication and first full CI run

Repository authorization was restored and the verified tree was published as
72384e4 on fix/architecture-hardening. GitHub Actions run 39362785925 passed all
125 regression tests and seven real Redis/PostgreSQL integration tests. The
first sandbox image build failed because Alpine 3.19 does not provide the GNU
time package requested by the Dockerfile. Updated the sandbox base to Alpine
3.23, whose package repository provides GNU time; the Docker execution, worker
image, production build and full-stack gates remain mandatory on the rerun.

## Strict CI and authenticated deployment stage

The Alpine correction passed GitHub Actions run 39363093657 at commit 6596e0f:
125 unit tests, seven real Redis/PostgreSQL integration tests, ten Docker sandbox
tests, worker image build, production Next build and the guest execution stack.
This supersedes the publication and Docker blockers recorded above.

The next stage adds a strict TAP gate for unit, integration and Docker suites.
It rejects failures, skips, TODOs, empty/incomplete reports, filtered test runs,
missing test files and exceeded process/output deadlines. CI retains TAP reports
and diagnostics, runs critical backend/runner lint with zero warnings, and uses
no test retries. Protocol regression tests exercise these rejection paths.

An explicit optional DATABASE_DRIVER=postgres transport supports bounded native
PostgreSQL pools while keeping Neon as the default. Parameterized statements,
transaction rollback, connection release, pool validation and definitive
transaction completion have regression coverage. Migration commands close pools.

The authenticated production-stack gate creates and migrates a disposable local
PostgreSQL database, seeds all three roles, requires two cluster workers and a
healthy execution worker, grades a real Docker submission, checks grade/attempt
persistence and hidden-case redaction, rotates a password/session, and executes
four real Chromium role/reload/privacy workflows. It rejects skipped/flaky browser
results and checks denied mutations did not persist. Cleanup stops process groups
and drops only the generated database. It never uses the configured Neon database.

Local verification: 141 unit tests passed with no skips/TODOs/failures. The new
real browser/cluster gate must pass GitHub CI before this stage is considered
verified; Docker is unavailable in the local workspace.

Remaining operational stages: apply reviewed migrations to the intended deployment
with a backup/rollback procedure; execute deployment:check against that deployment;
measure capacity with k6 at expected concurrency; verify backup restoration and
container-orphan cleanup on the deployment host. CI fixtures do not prove these
production operations.

First strict run 39364648825 passed all legacy gates and three of four browser
workflows. The admin courses browser trace exposed a real schema/UI mismatch:
the table called toUpperCase on course.status, a field absent from the baseline
schema and catalog API. Removed the unsupported status column and kept the
original browser assertions. A further native-transport regression verifies that
failed rollback discards the unsafe connection while preserving the original
query failure. The local suite now passes 142 tests without skips/TODOs/failures.

## Verified strict CI result

Commit 4d2526e passed GitHub Actions run
[39365103297](https://github.com/manthan01ce/Code-rank/actions/runs/39365103297).
All 142 unit tests, seven Redis/PostgreSQL integration tests, ten Docker sandbox
tests and four real Chromium role workflows passed with no skips or TODOs.
Critical lint passed with zero warnings. Compose validation, sandbox and worker
image builds, production Next build, guest execution and the authenticated
two-worker cluster all passed. Both Vercel commit checks also succeeded.

The earlier pending browser/cluster gate is closed by this run. It also verified
real migrations in a disposable database, Docker grading with persisted attempt
and best-grade rows, hidden-case redaction, password/session rotation and denied
role mutations. CI preserves TAP, browser JSON/HTML, traces and stack diagnostics.
Production migration, host readiness, k6 capacity and backup/orphan-recovery
validation remain operational work; no public database was migrated.
