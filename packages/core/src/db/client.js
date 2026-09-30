import { neon } from '@neondatabase/serverless';

/**
 * packages/core/src/db/client.js — Shared Neon Serverless Postgres client
 * -------------------------------------------------------------------------
 * Single source of truth for the DB connection across all apps (web + worker).
 *
 * PgBouncer compatibility notes:
 *  - Neon's HTTP driver is already connection-pool-friendly: each `sql` call
 *    opens an HTTP connection, executes, and closes — no persistent TCP
 *    connections that PgBouncer would struggle with.
 *  - If you add a PgBouncer proxy in front of Neon, append to DATABASE_URL:
 *      ?pgbouncer=true&connection_limit=1
 *    `pgbouncer=true`      → disables prepared statements (incompatible with
 *                            PgBouncer in transaction-mode pooling)
 *    `connection_limit=1`  → avoids multiple connections per serverless invoke
 *  - For direct Neon usage (recommended for serverless), no changes needed —
 *    Neon's HTTP driver effectively acts as its own connection pool.
 */

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://placeholder:placeholder@localhost/placeholder';

const sql = neon(connectionString);

export default sql;
