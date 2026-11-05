# Core facade regression acceptance (#97 / batch 5B)

The missing local regression evidence is now exercised against separate native
PostgreSQL 16.15 and Redis 7.2.5 processes over loopback TCP. This closes the scoped
facade-retirement acceptance gap; it does not certify sandbox isolation, end-to-end
compiler execution, performance, the college host, LAN or cloud deployment.

The follow-up starts from master `3fb23e0` and includes the previously unmerged
three-file developer-import correction: `check_user.mjs` uses public database/practical
entries, the import boundary rejects application/script bypasses of core feature
exports, and the consumer disposition includes that script. Existing runner grouping
and load-test fixes are preserved.

## Real database checks

`tests/integration/postgres.test.mjs` remains in the existing integration and selected
PostgreSQL discovery lanes. It has no database/module mocks and requires an explicit
isolated `TEST_DATABASE_URL`. In addition to the existing concurrent best-grade/case
consistency test, the public-client regression test verifies:

- Importing feature exports and calling readiness does not create a migration ledger.
- Explicit transactional migrations apply once; a second invocation is idempotent.
  Checksum drift makes readiness unhealthy without repairing the ledger.
- Native transaction commands set the actor before a real practical mutation on the
  same connection. A later SQL failure rolls back the practical and its audit.
- The API user service passes administrator and target in the correct order; only
  the intended student changes and the audit records the administrator.
- Real password comparison/session commit and active-actor lookups reject deactivation
  and session rotation immediately.
- The actual core attempt repository persists/replays one job identity; conflicting
  identities and invalid cases cannot leave partial grade/case/attempt rows. The
  migration ledger stays unchanged throughout these operations.

Every test creates a random schema and removes only its own schema. The underlying
server/database/data directory are disposable and contain synthetic fixtures only.
No operator database, seed/reset, persistent volume or SQL asset is changed.

## Real worker and Redis checks

The existing full `npm run test:integration` lane also runs real Redis admission,
queue limits, realtime transport, worker readiness/lease expiry, killed-worker recovery,
quota release, stalled-job exhaustion and drain checks. These are the owning regression
suites, not replacement mocks. The lane passes 13 tests with no failed, cancelled,
skipped or TODO tests. The strict runner reconciles all six discovered integration
files against actual file events.

The focused unit lane continues to check shared grading/late/replay/privacy policy,
pagination, authentication/session, users/reports/submissions, worker imports and
package ownership. Its executor fixtures remain unit evidence; they are not presented
as a real Docker/compiler pass. Docker is unavailable and no Docker execution or
broader batch/lab certification is claimed by this follow-up.

## Reproduction and final evidence

On an explicitly disposable native PostgreSQL/Redis host, configure `DATABASE_DRIVER=postgres`,
`DATABASE_URL` and `TEST_DATABASE_URL` for that database, plus its `REDIS_PORT` and a
synthetic `JWT_SECRET`, then run:

```bash
npm ci
npm run db:migrate
npm run db:migrate
npm run db:preflight
npm run test:integration
npm run lint:critical
npm test
npm run build --workspace=apps/api
```

This workspace used isolated PostgreSQL binaries from
`@embedded-postgres/linux-x64@16.15.0-beta.19` (server reports PostgreSQL 16.15), with
its shipped library symlinks restored, and Redis 7.2.5 built from its upstream source
with the libc allocator. Tools live outside the repository; project dependencies and
lockfile are unchanged. Fresh temporary data directories/random loopback ports are
used for each run. Unix sockets are disabled because this workspace disallows them.
Processes are stopped after the checks. These are native services, not PGlite or an
in-memory Redis emulation.

The follow-up PR records exact final tested/published/merged commit and tree identities,
commands, exit codes, native versions and report hashes. Final local and automatic fast
checks must pass before merge. Expensive architecture/performance Actions stay stopped;
no workflow labels, dispatches, triggers, thresholds or quarantines change. Broader
local-lab runtime requirements in the matrix stay unverified.
