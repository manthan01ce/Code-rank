import { neon } from '@neondatabase/serverless';

/**
 * packages/core/src/db/client.js — Shared Neon Serverless Postgres client
 * -------------------------------------------------------------------------
 * Single source of truth for the DB connection across all apps (web + worker).
 * Uses a dynamic Proxy to ensure process.env.DATABASE_URL is always current.
 */

let cachedSql = null;
let cachedUrl = null;

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
    return Reflect.apply(client, thisArg, argArray);
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
