/**
 * frontend/src/lib/db.js
 * ──────────────────────────────────────────────────────
 * Thin re-export of the shared database client from
 * @coderank/core.  All database access in the frontend
 * (Next.js API routes, server components, worker) goes
 * through this file so that import paths (`@/lib/db`)
 * continue to work without touching every consumer.
 *
 * The canonical implementation lives in:
 *   packages/core/src/db/client.js
 * ──────────────────────────────────────────────────────
 */

export { default, sql, pool, closePool, checkConnection } from '@coderank/core';
