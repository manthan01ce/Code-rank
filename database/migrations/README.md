# Database Migrations

This directory contains SQL migration files for the CodeRank database schema changes.

## Running Migrations

### Method 1: Using the Node.js Script (Recommended)

From the project root directory:

```bash
node database/run-migration.js
```

This script will:
- Load environment variables from `.env` file
- Connect to your Neon database using `DATABASE_URL`
- Execute all SQL files in the `migrations/` directory in order
- Log success/failure for each migration
- Handle errors gracefully

### Method 2: Using psql Command Line

If you have PostgreSQL client tools installed:

```bash
# On Windows (PowerShell)
$env:DATABASE_URL = "postgresql://user:password@host/database?sslmode=require"
psql $env:DATABASE_URL -f database/migrations/001_add_performance_indexes.sql

# On Linux/Mac
export DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
psql $DATABASE_URL -f database/migrations/001_add_performance_indexes.sql
```

## Migration Files

- **001_add_performance_indexes.sql** - Adds performance indexes on frequently queried columns:
  - `idx_courses_semester` - Speeds up course filtering by semester
  - `idx_courses_course_code` - Speeds up course lookups by code
  - `idx_departments_name` - Speeds up department searches
  - `idx_users_role` - Speeds up user queries filtered by role
  - `idx_users_status` - Speeds up active/inactive user filtering
  - `idx_practical_submissions_student` - Speeds up student submission lookups
  - `idx_practical_submissions_practical` - Speeds up practical submission queries
  - `idx_course_faculty_faculty` - Speeds up faculty course assignments
  - `idx_course_faculty_course` - Speeds up course faculty lookups

All indexes are created with `CONCURRENTLY` to avoid blocking the database during creation, and use `IF NOT EXISTS` for idempotency.

## Verifying Indexes

After running migrations, verify indexes were created:

```sql
-- Check all indexes on a specific table
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'courses';

-- Check if a specific index exists
SELECT indexname 
FROM pg_indexes 
WHERE indexname = 'idx_courses_semester';
```

## Testing Index Usage

Use `EXPLAIN ANALYZE` to verify the query planner uses indexes:

```sql
-- Should show "Index Scan using idx_courses_semester"
EXPLAIN ANALYZE 
SELECT * FROM courses WHERE semester = 1;

-- Should show "Index Scan using idx_users_role"
EXPLAIN ANALYZE 
SELECT * FROM users WHERE role = 'student';
```

## Environment Variables

The migration script requires the following environment variable:

- `DATABASE_URL` - Full PostgreSQL connection string (required)
  - Format: `postgresql://user:password@host:port/database?sslmode=require&connection_limit=10`
  - Should include `connection_limit` parameter for optimal pooling

## Troubleshooting

**Error: "relation does not exist"**
- Verify the table exists in your database schema
- Check you're connected to the correct database

**Error: "permission denied"**
- Ensure your database user has `CREATE INDEX` privilege
- For Neon databases, the owner user should have sufficient permissions

**Index creation takes too long**
- This is normal for large tables
- CONCURRENTLY mode doesn't block queries but takes longer
- Monitor progress with: `SELECT * FROM pg_stat_progress_create_index;`

**Error: "tuple concurrently updated"**
- Safe to retry - this can happen with CONCURRENTLY on busy tables
- The migration is idempotent and can be re-run safely
