import { neon, Pool } from '@neondatabase/serverless';

/**
 * packages/core/src/db/client.js
 * ──────────────────────────────────────────────────────────────────
 * Shared database client for CodeRank.
 *
 * This module provides TWO interfaces to Neon PostgreSQL:
 *
 *  1. `sql`  – Neon's tagged-template-literal function (HTTP-based).
 *              Used by ALL existing API routes and worker queries.
 *              Each call is a stateless HTTPS request — inherently
 *              pool-friendly and compatible with Neon's PgBouncer
 *              pooled endpoint.
 *
 *  2. `pool` – A Neon `Pool` instance (WebSocket-based, pg-compatible).
 *              Provides traditional connection-pooling semantics for
 *              use-cases that need transactions, cursors, or long-lived
 *              connections. Configured with safe defaults for Neon's
 *              pooled endpoint.
 *
 * Connection:
 *  - Reads DATABASE_URL from process.env (must be set server-side).
 *  - The URL should point to Neon's *pooled* endpoint (hostname
 *    contains "-pooler").
 *  - Never exposes credentials to client/browser code.
 *
 * Pool settings (all overridable via env vars):
 *  - DB_MAX_CONNECTIONS   – max pool size          (default: 10)
 *  - DB_IDLE_TIMEOUT      – idle timeout in ms     (default: 20 000)
 *  - DB_CONNECTION_TIMEOUT – connect timeout in ms (default: 10 000)
 * ──────────────────────────────────────────────────────────────────
 */

// ---------------------------------------------------------------------------
// Connection string
// ---------------------------------------------------------------------------
const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://placeholder:placeholder@localhost/placeholder';

// ---------------------------------------------------------------------------
// 1. Tagged-template SQL function (HTTP driver – existing interface)
// ---------------------------------------------------------------------------
const sql = neon(connectionString);

// ---------------------------------------------------------------------------
// 2. Connection Pool (WebSocket driver – pg.Pool compatible)
// ---------------------------------------------------------------------------
const maxConnections = parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10);
const idleTimeoutMs = parseInt(process.env.DB_IDLE_TIMEOUT || '20000', 10);
const connectionTimeoutMs = parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000', 10);

const pool = new Pool({
  connectionString,
  max: maxConnections,
  idleTimeoutMillis: idleTimeoutMs,
  connectionTimeoutMillis: connectionTimeoutMs,
});

// Attach a global error handler so un-handled pool errors don't crash the
// process.  We log a safe message that does NOT expose the connection string
// or credentials.
pool.on('error', (err) => {
  console.error('[DB Pool] Unexpected error on idle client:', err.message);
});

// ---------------------------------------------------------------------------
// Graceful shutdown helper
// ---------------------------------------------------------------------------

/**
 * Drain all idle connections in the pool.
 * Call this on SIGTERM / SIGINT in long-running processes (e.g. the worker).
 */
async function closePool() {
  try {
    await pool.end();
    console.log('[DB Pool] All connections closed.');
  } catch (err) {
    console.error('[DB Pool] Error while closing pool:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Health-check helper
// ---------------------------------------------------------------------------

/**
 * Verify database connectivity.  Returns `true` when the DB is reachable.
 * Never throws — returns `false` on failure.
 */
async function checkConnection() {
  try {
    const result = await sql`SELECT 1 AS ok`;
    return result?.[0]?.ok === 1;
  } catch (err) {
    console.error('[DB] Connection check failed:', err.message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export default sql;
export { sql, pool, closePool, checkConnection };
