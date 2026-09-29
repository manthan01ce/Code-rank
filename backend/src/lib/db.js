/**
 * backend/src/lib/db.js
 * ──────────────────────────────────────────────────────
 * Thin re-export of the shared database client from
 * @coderank/core.  The backend worker's execution files
 * (e.g. runDynamicPractical.js) import from this path,
 * so all existing `import sql from '../db.js'` statements
 * continue to work without modification.
 *
 * The canonical implementation lives in:
 *   packages/core/src/db/client.js
 * ──────────────────────────────────────────────────────
 */

export { default, sql, pool, closePool, checkConnection } from '@coderank/core';
