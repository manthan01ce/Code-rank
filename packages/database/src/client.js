import { neon } from '@neondatabase/serverless';
import { withTimeout } from './timeout.js';
import { createPostgresClient } from './postgres.js';

/**
 * packages/database/src/client.js — Shared PostgreSQL client
 * -------------------------------------------------------------------------
 * Single source of truth for the DB connection across all apps (web + worker).
 * Uses a dynamic Proxy to ensure process.env.DATABASE_URL is always current.
 * Queries have timeout protection. Native transactions await definitive completion.
 */

let cachedSql = null;
let cachedConfig = null;

// Default timeout: 30 seconds (configurable via environment)
const DB_QUERY_TIMEOUT_MS = parseInt(process.env.DB_QUERY_TIMEOUT_MS || '30000', 10);

function getSql() {
  const url =
    process.env.DATABASE_URL ||
    'postgresql://placeholder:placeholder@localhost/placeholder';
  const driver = process.env.DATABASE_DRIVER || 'neon';
  if (!['neon', 'postgres'].includes(driver)) throw Error('DATABASE_DRIVER must be neon or postgres');
  const config = JSON.stringify([driver, url, process.env.DB_POOL_SIZE, process.env.DB_QUERY_TIMEOUT_MS]);
  if (!cachedSql || cachedConfig !== config) {
    // Enable fetch connection cache and pool query via fetch for better performance
    const next = driver === 'postgres' ? createPostgresClient(url, {poolSize: process.env.DB_POOL_SIZE, timeoutMs: process.env.DB_QUERY_TIMEOUT_MS}) : neon(url, {
      fetchConnectionCache: true,
      poolQueryViaFetch: true
    });
    const prior = cachedSql; cachedSql = next; cachedConfig = config;
    if (prior?.close) void prior.close().catch(() => {});
  }
  return cachedSql;
}

const sql = new Proxy(function () {}, {
  apply(_target, thisArg, argArray) {
    const client = getSql();
    const queryPromise = Reflect.apply(client, thisArg, argArray);
    // Wrap the query with timeout protection
    return withTimeout(queryPromise, DB_QUERY_TIMEOUT_MS);
  },
  get(_target, prop, receiver) {
    const client = getSql();
    const val = Reflect.get(client, prop, receiver);
    if (typeof val === 'function') {
      // Native transactions must resolve only after definitive COMMIT/ROLLBACK.
      // A Promise.race here could report failure while a transaction still commits.
      if (prop === 'transaction' && process.env.DATABASE_DRIVER === 'postgres') return val.bind(client);
      if (prop === 'query' || prop === 'transaction') return (...args) => withTimeout(val.apply(client, args), DB_QUERY_TIMEOUT_MS);
      return val.bind(client);
    }
    return val;
  }
});

export async function closeDatabase() {
  const current = cachedSql; cachedSql = null; cachedConfig = null;
  if (current?.close) await current.close();
}

export default sql;
