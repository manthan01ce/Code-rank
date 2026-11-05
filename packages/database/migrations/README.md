# Versioned database migrations

Run from the repository root:

```sh
npm run db:preflight
npm run db:migrate
```

Preflight is read-only. It reports duplicate grades/workspaces, missing columns,
pending migrations and altered migration checksums. A missing column can be the
specific condition a pending compatibility migration repairs; review the report.

The migration runner loads local environment settings and applies numbered SQL
files in order. Each migration and its ledger insert use one PostgreSQL transaction
and a shared advisory lock. `coderank_migrations` stores file names and SHA-256
checksums. Applied files must never be edited; add a later numbered migration.

SQL files use explicit `-- statement-breakpoint` markers. Never split SQL on
semicolons: PostgreSQL functions contain internal semicolons. Do not apply files
individually with psql, which would omit the migration ledger and transaction gates.

Current stages:

- 000: core baseline for an empty database; existing tables remain intact.
- 001: indexes.
- 002: attempt ledger, unique best grades, transactional grading/reset primitives.
- 003: practical and mapping transactions.
- 004: deployed-schema compatibility and user-management transactions.
- 005: course/department transactions with history/reference preservation.
- 006: current-assignment authorization, submission reset and audit in one transaction.

Index creation is transactional and **does not use CONCURRENTLY**. On a large
database it can block writes. Back up application data, drain old workers and
schedule an appropriate maintenance window before application-schema migration.
Duplicate historic grades stop the migration rather than being deleted.

For isolated verification:

```sh
npm test
npm run test:postgres  # disposable TEST_DATABASE_URL
npm run test:neon      # creates/removes isolated schemas; needs Neon configuration
```

The Neon upgrade test copies deployed columns/defaults/indexes into private test
schemas and gives them private sequences. It does not copy application records or
foreign keys. Fresh-schema tests exercise baseline foreign keys separately.
