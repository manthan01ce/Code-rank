# Database assets and lifecycle ownership (#76)

#76 may precede #75: its sole hard prerequisite #70 is merged via #86/d968f7c. Frontend shell work is independent. This branch starts from master 84d273e after a successful clean checkout/pull.

## SQL identity recorded before movement

| Original name/path | Owning path | Original raw SHA-256 |
| --- | --- | --- |
| `database/init.sql` | `packages/database/bootstrap/init.sql` | `f5572042949473472035eb9489689cac7c5acd0537cc244bdaf937089acd13f9` |
| `database/migrations/000_baseline.sql` | `packages/database/migrations/000_baseline.sql` | `1f86d97708422cdf734c3d451e0f778e0096070501dac102ffec8353ee62e204` |
| `database/migrations/001_add_performance_indexes.sql` | `packages/database/migrations/001_add_performance_indexes.sql` | `933bb28909503dcdc4757bdfb48ffd71de028bb02c90efb74b67f038e56ca66b` |
| `database/migrations/002_submission_attempts.sql` | `packages/database/migrations/002_submission_attempts.sql` | `a745d76ad672e31d820be3433a1b05bb763f236d48379efddda1928fc6a784ff` |
| `database/migrations/003_admin_transactions.sql` | `packages/database/migrations/003_admin_transactions.sql` | `a5ea50806058fba51305babac9a228ec85b0c4f007e18b18f40bfc2eddbb7359` |
| `database/migrations/004_user_management.sql` | `packages/database/migrations/004_user_management.sql` | `dacec7d60838604067a2fc3610a6dcd7625cfd7bd80c734f215aff8c5cdfcd16` |
| `database/migrations/005_course_department_management.sql` | `packages/database/migrations/005_course_department_management.sql` | `e5598ee011e3b4131fb19442e97e477281cf290f19d81a0d109f59373122ee2c` |
| `database/migrations/006_authorized_submission_reset.sql` | `packages/database/migrations/006_authorized_submission_reset.sql` | `44a25034144095c56b0fab5c858911812e1472de0b0c8810159494e486b28ae5` |
| `database/migrations/007_retention_and_report_indexes.sql` | `packages/database/migrations/007_retention_and_report_indexes.sql` | `049ae70c7f29492f94489d832afa66649147db2027c7d13a473db317e9b54c31` |

All SQL was renamed without rewriting bytes. The existing readiness manifest and ledger names/checksums remain unchanged. sql-assets.sha256.json records the raw-byte audit; migrations retain their existing normalized ledger hashing. The historical pre-move path-consumer inventory is database-assets-consumers.json. Current tests, root commands, release/recovery tools, Compose mounts, CI container migration commands and operator docs point at package-owned assets.

Migrations are in packages/database/migrations; init.sql is bootstrap/init.sql; the explicit destructive development seed is seeds/seed.js. Lifecycle CLIs are scripts/run-migration.js, preflight.js and update-readiness-manifest.js. Supported commands remain npm run db:migrate, db:preflight, db:seed and db:manifest. Add npm run db:inspect for read-only columns/indexes/index-progress inspection. Module-relative URLs and the exported @coderank/database/assets entry resolve independently of cwd and platform. loadMigrations defaults to the package-owned URL while retaining injectable directories for fixtures.

## Maintenance consolidation

Retired create-indexes-direct.js, create-indexes-final.mjs, create-indexes-sync.js and create-indexes-sync.mjs wrote schema outside the migration ledger (including driver-specific unsafe/eval variants). Retired check-schema.mjs also created/dropped a test index despite its diagnostic name. debug-indexes.mjs, list-all-indexes.js, verify-indexes.js and check-index-progress.js duplicated Neon-specific diagnostics. Their supported replacement scripts/inspect-schema.js performs only SELECTs through the existing shared driver and always closes it. It prints structured diagnostic data or a sanitized error code. Apply versioned migrations for index changes; inspection never applies DDL. No diagnostic or migration was executed against an operator database during this refactor.

Environment loading and existing-process precedence, driver selection/retries, migration transactions/advisory locking, seed refusal/acknowledgement and backup/restore workflow remain unchanged. Readiness/startup never migrate. Compose changes only the bootstrap bind source; PostgreSQL/Redis named volume identities are untouched. API and worker Docker COPY already include packages/database (worker copies all packages), so the relocated assets stay in those images without duplicate COPY lines. Web still receives no database package.

## Verification and limitations

Byte checks and manifest identity, outside-cwd asset resolution and seed refusal have focused tests. Existing disposable PGlite migration/idempotence/drift/missing-ledger, schema/readiness, transaction and seed-safety tests run in the full unit lane with owning paths updated; assertions remain intact. The read-only maintenance test verifies every issued statement and client cleanup. Manifest regeneration is build-time only and yields an unchanged required-migrations.json.

The first unit run found the already-merged master Vercel enablement conflicted with the old disabled-only architecture assertion. That expectation now pins the exact current root and Next workspace deployment configurations; backend-import, secret and public route isolation assertions remain intact. No deployment configuration is changed here.

Real PostgreSQL/Redis recovery/restore, integration, all Docker image builds and full container topology remain pending because Docker is unavailable locally. Expensive CI is stopped by owner direction: do not add ci:full-stack or ci:auth-performance labels. Application builds and unit checks are not full runtime certification. Rollback is an application revert PR, never a database or volume reset.

Publication review found pre-existing credential-bearing Neon documentation examples. Those examples are replaced with placeholders; no environment settings, live credentials or SQL assets are changed.
