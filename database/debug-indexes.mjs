#!/usr/bin/env node

import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env') });

const sql = neon(process.env.DATABASE_URL);

console.log('🔍 Debugging Index Creation\n');

// Check pg_class directly
const pgClass = await sql`
  SELECT relname, relkind
  FROM pg_class
  WHERE relname LIKE 'idx_%'
  AND relname IN (
    'idx_courses_semester', 'idx_courses_course_code', 'idx_departments_name',
    'idx_users_role', 'idx_users_status',
    'idx_practical_submissions_student', 'idx_practical_submissions_practical',
    'idx_course_faculty_faculty', 'idx_course_faculty_course'
  )
`;

console.log('Direct pg_class query:');
if (pgClass.length > 0) {
  pgClass.forEach(c => console.log(`  Found: ${c.relname} (kind: ${c.relkind}, valid: ${c.relisvalid})`));
} else {
  console.log('  None found in pg_class\n');
}

// Try a simpler pg_indexes query
console.log('\nSimple pg_indexes query:');
const simple = await sql`
  SELECT * FROM pg_indexes 
  WHERE indexname = 'idx_courses_semester'
  LIMIT 1
`;
console.log('Result:', simple);

// Check if index works
console.log('\n🧪 Testing if index is used:\n');
try {
  const explain = await sql`
    EXPLAIN SELECT * FROM courses WHERE semester = 1
  `;
  console.log('EXPLAIN output:');
  explain.forEach(line => console.log(line['QUERY PLAN']));
} catch (error) {
  console.log('Error:', error.message);
}

process.exit(0);
