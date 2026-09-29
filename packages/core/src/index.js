/**
 * packages/core  –  barrel export
 *
 * Re-exports everything from the database client so consumers can write:
 *
 *   import sql from '@coderank/core';            // default = sql
 *   import { sql, pool, closePool } from '@coderank/core';
 *   import sql from '@coderank/core/db';         // also works via "exports" map
 */

export { default, sql, pool, closePool, checkConnection } from './db/client.js';
