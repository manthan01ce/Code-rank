import { neon } from '@neondatabase/serverless';
import { withTimeout } from '../utils/timeout.js';

/**
 * packages/core/src/db/client.js — Shared Neon Serverless Postgres client
 * -------------------------------------------------------------------------
 * Single source of truth for the DB connection across all apps (web + worker).
 * Uses a dynamic Proxy to ensure process.env.DATABASE_URL is always current.
 * Wraps all queries with timeout protection (default 30s, configurable via DB_QUERY_TIMEOUT_MS).
 */

let cachedSql = null;
let cachedUrl = null;

// Default timeout: 30 seconds (configurable via environment)
const DB_QUERY_TIMEOUT_MS = parseInt(process.env.DB_QUERY_TIMEOUT_MS || '30000', 10);

function getSql() {
  const url =
    process.env.DATABASE_URL ||
    'postgresql://placeholder:placeholder@localhost/placeholder';
  if (!cachedSql || cachedUrl !== url) {
    cachedUrl = url;
    // Enable fetch connection cache and pool query via fetch for better performance
    cachedSql = neon(url, {
      fetchConnectionCache: true,
      poolQueryViaFetch: true
    });
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
      return val.bind(client);
    }
    return val;
  }
});

export default sql;
