#!/usr/bin/env node

import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env') });

const sql = neon(process.env.DATABASE_URL, {
  fetchConnectionCache: true,
  poolQueryViaFetch: true
});

console.log('🔧 Creating Performance Indexes (without CONCURRENTLY)\n');

const indexes = [
  { name: 'idx_courses_semester', sql: 'CREATE INDEX idx_courses_semester ON courses(semester)' },
  { name: 'idx_courses_course_code', sql: 'CREATE INDEX idx_courses_course_code ON courses(course_code)' },
  { name: 'idx_departments_name', sql: 'CREATE INDEX idx_departments_name ON departments(name)' },
  { name: 'idx_users_role', sql: 'CREATE INDEX idx_users_role ON users(role)' },
  { name: 'idx_users_status', sql: 'CREATE INDEX idx_users_status ON users(status)' },
  { name: 'idx_practical_submissions_student', sql: 'CREATE INDEX idx_practical_submissions_student ON practical_submissions(student_id)' },
  { name: 'idx_practical_submissions_practical', sql: 'CREATE INDEX idx_practical_submissions_practical ON practical_submissions(practical_id)' },
  { name: 'idx_course_faculty_faculty', sql: 'CREATE INDEX idx_course_faculty_faculty ON course_faculty(faculty_id)' },
  { name: 'idx_course_faculty_course', sql: 'CREATE INDEX idx_course_faculty_course ON course_faculty(course_id)' },
];

let created = 0;
let skipped = 0;
let failed = 0;

for (const idx of indexes) {
  try {
    console.log(`Creating ${idx.name}...`);
    await sql.unsafe(idx.sql);
    console.log(`  ✅ Created ${idx.name}\n`);
    created++;
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log(`  ⏭️  Already exists: ${idx.name}\n`);
      skipped++;
    } else {
      console.log(`  ❌ Failed: ${error.message}\n`);
      failed++;
    }
  }
}

console.log('=====================================');
console.log(`✅ Created: ${created}`);
console.log(`⏭️  Skipped (existing): ${skipped}`);
console.log(`❌ Failed: ${failed}`);
console.log('=====================================\n');

// Verify immediately
const result = await sql`
  SELECT indexname, tablename 
  FROM pg_indexes 
  WHERE indexname IN (
    'idx_courses_semester', 'idx_courses_course_code', 'idx_departments_name',
    'idx_users_role', 'idx_users_status',
    'idx_practical_submissions_student', 'idx_practical_submissions_practical',
    'idx_course_faculty_faculty', 'idx_course_faculty_course'
  )
  ORDER BY tablename, indexname
`;

console.log(`\nVerified FEAT-004 indexes: ${result.length}/9`);
result.forEach(r => console.log(`  ✅ ${r.indexname} on ${r.tablename}`));

if (result.length < 9) {
  console.log('\n⚠️  Some indexes missing - checking if similar indexes exist...');
  
  const similar = await sql`
    SELECT indexname, tablename, indexdef
    FROM pg_indexes
    WHERE tablename IN ('courses', 'departments', 'users', 'practical_submissions', 'course_faculty')
    AND indexname LIKE 'idx_%'
    ORDER BY tablename, indexname
  `;
  
  console.log(`\nExisting performance indexes (${similar.length}):`);
  similar.forEach(s => console.log(`  - ${s.indexname} on ${s.tablename}`));
}

process.exit(0);
