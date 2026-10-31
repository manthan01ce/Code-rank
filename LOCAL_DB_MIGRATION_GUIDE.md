# CodeRank: Neon → Local PostgreSQL Migration Guide

This guide provides the exact, reproducible steps to migrate CodeRank from Neon Serverless Postgres to a local PostgreSQL instance and validate all routes according to the release-gate criteria.

---

## 1. Detected Stack Architecture

| Component | Technology | Configuration in CodeRank |
| :--- | :--- | :--- |
| **Database Driver** | `pg` (`pg.Pool`) & `@neondatabase/serverless` | Supported natively via `packages/database/src/client.js` and `postgres.js` |
| **Driver Selection** | Environment Variable | `DATABASE_DRIVER=postgres` (local) vs `DATABASE_DRIVER=neon` (cloud) |
| **Local SSL Mode** | `sslmode=disable` | Required for local connections without TLS certs |
| **Migrations** | Versioned SQL scripts | `database/migrations/000_baseline.sql` through `006_authorized_submission_reset.sql` |
| **Queue & Cache** | Redis 7+ & BullMQ | `127.0.0.1:6379` (Docker container active) |
| **Execution Sandboxes**| Docker (`coderank-base`) | Python, C++, C, Java, JavaScript daemon containers active |

---

## 2. Step 1: Start Local PostgreSQL (Docker)

If you don't already have a local PostgreSQL 15/16 service running, start one using Docker:

```bash
docker run -d \
  --name coderank-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=coderank_local \
  -p 5432:5432 \
  postgres:16-alpine
```

Verify it is listening:
```bash
docker exec -it coderank-postgres pg_isready -U postgres
```

---

## 3. Step 2: Export Data from Neon (Read-Only)

> **Important**: Per rule #1, Neon is **read-only**. Never execute DDL or writes against Neon.

Use `pg_dump` with `--clean --if-exists --no-owner --no-privileges` to export a clean dump:

```bash
# Export schema + data from Neon:
pg_dump "postgresql://neondb_owner:npg_xfyu3nXC9EeJ@ep-shy-star-a4cmtjl2-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  -F p \
  -f neon_dump.sql
```

---

## 4. Step 3: Restore to Local PostgreSQL

Restore the dump into your local `coderank_local` database:

```bash
psql "postgresql://postgres:postgres@localhost:5432/coderank_local?sslmode=disable" -f neon_dump.sql
```

If restoring into a fresh database without pre-dumped data, apply repository migrations directly:

```bash
npm run db:migrate
```

---

## 5. Step 4: Configure Environment Variables

Edit your `.env` (or `.env.local`):

```dotenv
# ---------------------------------------------------------
# Local Database Configuration
# ---------------------------------------------------------
DATABASE_DRIVER=postgres
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/coderank_local?sslmode=disable
DB_POOL_SIZE=10
DB_QUERY_TIMEOUT_MS=30000

# ---------------------------------------------------------
# Redis Queue Configuration
# ---------------------------------------------------------
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# ---------------------------------------------------------
# Authentication & Ports
# ---------------------------------------------------------
PORT=3000
ALLOWED_ORIGIN=http://localhost:3000
```

---

## 6. Step 5: Run Verification Preflight

Execute the built-in migration preflight script to ensure all tables, migrations, and checksums match:

```bash
npm run db:preflight
```

Expected output:
```json
{
  "readOnly": true,
  "missingColumns": [],
  "counts": {
    "submissions": 10,
    "duplicate_grades": 0,
    "duplicate_workspaces": 0
  },
  "alteredMigrations": [],
  "pendingMigrations": []
}
```

Then run the database integration test:
```bash
npm run test:postgres
```

And full unit test suite:
```bash
npm test
```

---

## 7. Step 6: Route Validation Matrix

Once local DB is active, execute live HTTP checks against the server for each role:

| Endpoint | Method | Role | Expected Status |
| :--- | :--- | :--- | :--- |
| `/api/health` | `GET` | Public | `200` (`status: healthy`) |
| `/api/auth/login` | `POST` | Public | `200` with JWT token |
| `/api/auth/profile` | `GET` | Authenticated | `200` with user details |
| `/api/stats` | `GET` | Admin | `200` with counts |
| `/api/courses` | `GET` | Admin / Faculty | `200` |
| `/api/departments` | `GET` | Admin / Faculty | `200` |
| `/api/student/practicals` | `GET` | Student | `200` |
| `/api/student/workspaces/load` | `GET` | Student | `200` |
| `/api/student/workspaces/save` | `POST` | Student | `200` |
| `/api/python-run` | `POST` | Student | `200` (dispatches BullMQ job) |
| `/api/submit` | `POST` | Student | `200` (evaluates against test cases) |

---

## 8. Troubleshooting

1. **Connection Refused**: Ensure PostgreSQL is running and port `5432` is mapped (`docker ps`).
2. **SSL Error**: Ensure `?sslmode=disable` is specified in `DATABASE_URL` when connecting locally.
3. **Database Driver**: Verify `DATABASE_DRIVER=postgres` is set in your `.env` so `packages/database/src/client.js` loads `pg.Pool` instead of the Neon HTTP client.
