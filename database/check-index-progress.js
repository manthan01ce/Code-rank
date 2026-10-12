#!/usr/bin/env node

import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env') });

const sql = neon(process.env.DATABASE_URL);

console.log('🔍 Checking Index Creation Progress\n');

// Check for ongoing index creation
try {
  const progress = await sql`
    SELECT 
      phase,
      round(100.0 * blocks_done / nullif(blocks_total, 0), 1) AS pct_done,
      tuples_done,
      tuples_total
    FROM pg_stat_progress_create_index
  `;
  
  if (progress.length > 0) {
    console.log('Indexes currently being built:');
    console.log(progress);
  } else {
    console.log('No indexes currently being built concurrently.\n');
  }
} catch (error) {
  console.log('Could not check progress:', error.message);
}

// Check all indexes including invalid ones
const allIndexes = await sql`
  SELECT 
    i.indexname,
    i.tablename,
    idx.indisvalid AS is_valid
  FROM pg_indexes i
  JOIN pg_class c ON c.relname = i.indexname
  JOIN pg_index idx ON idx.indexrelid = c.oid
  WHERE i.tablename IN ('courses', 'departments', 'users', 'practical_submissions', 'course_faculty')
  ORDER BY i.tablename, i.indexname
`;

console.log(`\nAll indexes (including invalid/building):\n`);
allIndexes.forEach(idx => {
  const status = idx.is_valid ? '✅ Valid' : '⏳ Building/Invalid';
  console.log(`${status}: ${idx.indexname} on ${idx.tablename}`);
});

process.exit(0);
