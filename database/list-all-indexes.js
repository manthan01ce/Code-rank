#!/usr/bin/env node

import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env') });

const sql = neon(process.env.DATABASE_URL);

console.log('🔍 Listing ALL Indexes\n');

const allIndexes = await sql`
  SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
  FROM pg_indexes
  WHERE schemaname = 'public'
  ORDER BY tablename, indexname
`;

console.log(`Found ${allIndexes.length} total indexes in public schema:\n`);

allIndexes.forEach(idx => {
  console.log(`${idx.tablename}.${idx.indexname}`);
});

// Now specifically search for our new indexes
console.log('\n\n🎯 Searching for FEAT-004 indexes:\n');

const targetNames = [
  'idx_courses_semester',
  'idx_courses_course_code',
  'idx_departments_name',
  'idx_users_role',
  'idx_users_status',
  'idx_practical_submissions_student',
  'idx_practical_submissions_practical',
  'idx_course_faculty_faculty',
  'idx_course_faculty_course'
];

for (const name of targetNames) {
  const found = allIndexes.find(i => i.indexname === name);
  if (found) {
    console.log(`✅ ${name} EXISTS`);
    console.log(`   ${found.indexdef}\n`);
  } else {
    console.log(`❌ ${name} NOT FOUND\n`);
  }
}

process.exit(0);
