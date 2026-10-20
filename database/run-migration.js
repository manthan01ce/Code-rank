#!/usr/bin/env node
import '../packages/core/src/config/env.js';
import { neon } from '@neondatabase/serverless';
import { migrate } from '../packages/database/src/migrations.js';

if (!process.env.DATABASE_URL || /YOUR_PASSWORD|your-database-id/.test(process.env.DATABASE_URL)) {
  throw new Error('Configure a real DATABASE_URL before running migrations');
}
const sql = neon(process.env.DATABASE_URL);
const adapter = {
  query: (text, values) => sql.query(text, values),
  apply: migration => sql.transaction(tx => [
    tx.query('SELECT pg_advisory_xact_lock(20401017, 1)'),
    ...migration.statements.map(text => tx.query(text)),
    tx.query('INSERT INTO coderank_migrations(name, checksum) VALUES ($1, $2)', [migration.name, migration.checksum]),
  ]),
};
try {
  const applied = await migrate(adapter, new URL('./migrations/', import.meta.url));
  console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database migrations are current');
} catch (error) {
  console.error('Migration failed; its transaction was rolled back:', error.message);
  process.exitCode = 1;
}
