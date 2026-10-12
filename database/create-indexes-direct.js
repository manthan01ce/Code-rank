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

console.log('🔧 Creating Performance Indexes\n');

const indexes = [
  { name: 'idx_courses_semester', table: 'courses', column: 'semester' },
  { name: 'idx_courses_course_code', table: 'courses', column: 'course_code' },
  { name: 'idx_departments_name', table: 'departments', column: 'name' },
  { name: 'idx_users_role', table: 'users', column: 'role' },
  { name: 'idx_users_status', table: 'users', column: 'status' },
  { name: 'idx_practical_submissions_student', table: 'practical_submissions', column: 'student_id' },
  { name: 'idx_practical_submissions_practical', table: 'practical_submissions', column: 'practical_id' },
  { name: 'idx_course_faculty_faculty', table: 'course_faculty', column: 'faculty_id' },
  { name: 'idx_course_faculty_course', table: 'course_faculty', column: 'course_id' },
];

let created = 0;
let skipped = 0;
let failed = 0;

for (const idx of indexes) {
  try {
    console.log(`Creating ${idx.name}...`);
    await sql.unsafe(`CREATE INDEX CONCURRENTLY ${idx.name} ON ${idx.table}(${idx.column})`);
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

// Verify
const result = await sql`
  SELECT indexname, tablename 
  FROM pg_indexes 
  WHERE indexname LIKE 'idx_%'
  AND tablename IN ('courses', 'departments', 'users', 'practical_submissions', 'course_faculty')
  ORDER BY tablename, indexname
`;

console.log(`\nTotal performance indexes: ${result.length}`);
result.forEach(r => console.log(`  - ${r.indexname} on ${r.tablename}`));

process.exit(0);
