#!/usr/bin/env node

import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env') });

const sql = neon(process.env.DATABASE_URL);

console.log('🔍 Verifying Database Indexes\n');

const indexes = await sql`
  SELECT indexname, tablename, indexdef 
  FROM pg_indexes 
  WHERE tablename IN ('courses', 'departments', 'users', 'practical_submissions', 'course_faculty')
  ORDER BY tablename, indexname
`;

console.log(`Found ${indexes.length} total indexes:\n`);

const targetIndexes = [
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

console.log('Target Performance Indexes (from FEAT-004):');
console.log('===========================================');

targetIndexes.forEach(name => {
  const found = indexes.find(i => i.indexname === name);
  if (found) {
    console.log(`✅ ${name} on ${found.tablename}`);
  } else {
    console.log(`❌ ${name} NOT FOUND`);
  }
});

console.log('\nAll Indexes on Target Tables:');
console.log('============================');

indexes.forEach(idx => {
  console.log(`- ${idx.indexname} on ${idx.tablename}`);
});

// Test query performance
console.log('\n📊 Testing Index Usage with EXPLAIN ANALYZE:\n');

try {
  const explainResult = await sql`
    EXPLAIN (FORMAT JSON) 
    SELECT * FROM courses WHERE semester = 1
  `;
  const plan = explainResult[0]['QUERY PLAN'][0]['Plan'];
  console.log('Query: SELECT * FROM courses WHERE semester = 1');
  console.log(`Plan Type: ${plan['Node Type']}`);
  if (plan['Index Name']) {
    console.log(`✅ Using Index: ${plan['Index Name']}`);
  } else {
    console.log(`⚠️  No index used (Seq Scan)`);
  }
} catch (error) {
  console.log('Could not test query plan:', error.message);
}

process.exit(0);
