import { neon } from '@neondatabase/serverless';

/**
 * db.js – Neon Serverless Postgres connection
 * -------------------------------------------
 * PgBouncer compatibility notes:
 *  - Neon's HTTP driver (@neondatabase/serverless) is already connection-pool-friendly:
 *    each `sql` call opens an HTTP connection, executes, and closes — no persistent
 *    TCP connections that PgBouncer would struggle with.
 *  - If you add a PgBouncer proxy in front of Neon, append these params to DATABASE_URL:
 *      ?pgbouncer=true&connection_limit=1
 *    `pgbouncer=true`      → disables prepared statements (incompatible with PgBouncer
 *                            in transaction-mode pooling)
 *    `connection_limit=1`  → avoids multiple connections per serverless invocation
 *  - For direct Neon usage (recommended for serverless), no changes are needed —
 *    Neon's HTTP driver effectively acts as its own connection pool.
 *
 * The DATABASE_URL format with PgBouncer:
 *   postgresql://user:pass@pgbouncer-host:5432/dbname?pgbouncer=true&connection_limit=1&sslmode=require
 */

// Use environment DATABASE_URL, with a safe placeholder fallback to avoid
// compile-time crashes during Vercel/Next.js build phases.
const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://placeholder:placeholder@localhost/placeholder';

const sql = neon(connectionString);

export default sql;
