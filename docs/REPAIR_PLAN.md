# Architecture repair plan

Baseline: master f476fdc. Public page and API paths must remain stable.

## Verification rule

Each behavioral change receives a focused regression check before the next
change. Run the accumulated suite after each stage. Report unavailable gates
explicitly; a mocked test is not a Docker, Redis, or database integration test.

## Stages and acceptance gates

1. **Execution authorization and result privacy.** Consolidate queue access;
   authorize job ownership, anonymous browser sessions, and practical access;
   strip hidden test data. Gate: denied cross-user access, hidden-case redaction,
   valid student/faculty access, and preserved route inventory.
2. **Realtime trust.** Authenticate sockets and room membership; reject public
   completion/event publishing; use a separately authenticated service channel.
   Gate: forged worker events and unauthorized room subscriptions are denied.
3. **Runner correctness.** Enforce in-container timeouts, successful exit status,
   private execution directories, explicit cleanup, and trustworthy results.
   Gate: runtime failures never pass, timeout is reported, same-source jobs do
   not share writable artifacts. Docker execution remains an integration gate.
4. **Deployment and route consistency.** Reconcile workspace launchers and
   runner definitions, install worker Docker CLI, load root environment before
   application modules, and fail closed on unsupported clustering.
   Gate: source checks, launcher syntax, route/import checks, production build.
5. **Database concurrency and scaling (separate integration stage).** Add a
   complete baseline schema, transactional attempt/result persistence, atomic
   best-score updates, idempotency, bounded admission, pagination, queue fairness,
   Redis durability and capacity limits. Gate: real database/Redis concurrency
   tests and repeatable migration from an empty database.
6. **Final modularization and capacity validation.** Extract backend domain
   modules and queue/runner packages after contracts are covered; retire legacy
   copies only after deployment parity. Gate: end-to-end student/faculty flows,
   five-language sandbox tests, crash/retry recovery, and measured load tests.

## Current implementation status

Stages 1–5 have local implementations and targeted checks. Stage 6 has domain,
database, queue and runner extraction plus removed active-web execution copies.
Read IMPLEMENTATION_REPORT.md for the exact verification and remaining scope.

Disposable per-job sandboxes now replace shared daemons. Redis admission has a
real concurrency test; grading/migrations have embedded PostgreSQL tests.
The third increment adds transactional practical/mapping management, bounded
submission history, C/JavaScript function harnesses, and a shared realtime adapter
with real Redis cross-server tests. Actual
Docker, multi-connection PostgreSQL, production build and deployment/load gates
remain required. Broader administrative route extraction and pagination remain
separate work. Preserve route contracts while completing them.

Fourth increment: transactional user management/imports, persistent admin bootstrap,
bounded course matrices, profile privacy and a read-only migration preflight. Real
Neon concurrency and deployed-definition upgrade checks now pass in isolated
schemas. Public application migration, Docker, browser and load gates remain open.

Fifth increment: course/department transactions, bounded selector queries and all
first-party consumers, worker readiness/shutdown, queue index cleanup, active-session
and realtime membership revocation, atomic password rotation, and authorized
submission reset. Migrations through 006 are required before deployment.

Sixth increment: added full production web/worker execution smoke, worker-image
and Compose CI checks, read-only deployment readiness verification, and
output-verified capacity metrics. GitHub publication is blocked by the connected
app's repository permissions; actual Docker/full-stack/browser/load deployment
gates remain open until suitable infrastructure and repository access are available.

Seventh increment: real child-process worker crash/stall recovery and production
graceful-drain checks; read-only required-migration/checksum readiness; bundled
manifest synchronization gate. Public database migrations remain unapplied.
