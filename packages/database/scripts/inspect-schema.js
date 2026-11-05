#!/usr/bin/env node
// Supported read-only replacement for legacy index creation/debug variants.
import '@coderank/core/config/env';
import sql, { closeDatabase } from '../src/client.js';
try {
  const columns = await sql.query("SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position");
  const indexes = await sql.query("SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname");
  const progress = await sql.query('SELECT phase,blocks_done,blocks_total,tuples_done,tuples_total FROM pg_stat_progress_create_index');
  console.log(JSON.stringify({ readOnly: true, columns, indexes, progress }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ inspection: 'failed', code: error.code || 'DATABASE_ERROR' }));
  process.exitCode = 1;
} finally { await closeDatabase(); }
