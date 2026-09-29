import { neon } from '@neondatabase/serverless';

/**
 * db.js – Neon Serverless Postgres connection with PgBouncer Pooling Support
 * ---------------------------------------------------------------------------
 * PgBouncer / Connection Pooler compatibility:
 *  - Neon's HTTP driver (@neondatabase/serverless) executes queries statelessly over HTTPS.
 *  - To route through Neon's native PgBouncer connection pooler, use the pooled endpoint:
 *      ep-xxxx-pooler.us-east-1.aws.neon.tech (notice "-pooler" in host)
 *  - If using external PgBouncer or transaction mode pooling, append:
 *      ?pgbouncer=true&connection_limit=1&sslmode=require
 *    `pgbouncer=true` disables named prepared statements incompatible with transaction-mode pooling.
 */
const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://placeholder:placeholder@localhost/placeholder';

const sql = neon(connectionString);

export default sql;
