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

console.log('🔧 Creating FEAT-004 Performance Indexes\n');

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
    // Build the CREATE INDEX statement dynamically
    const createSQL = `CREATE INDEX ${idx.name} ON ${idx.table}(${idx.column})`;
    // Execute with the sql function - we need to evaluate as a template literal
    await eval('sql`' + createSQL + '`');
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

// Verify all indexes
console.log('🔍 Verifying created indexes:\n');

const verified = await sql`
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

console.log(`✅ Verified ${verified.length}/9 indexes:`);
verified.forEach(v => console.log(`   - ${v.indexname} on ${v.tablename}`));

// Test index usage
console.log('\n📊 Testing index usage:\n');

const explain = await sql`EXPLAIN SELECT * FROM courses WHERE semester = 1`;
const plan = explain.map(e => e['QUERY PLAN']).join('\n');
console.log('Query: SELECT * FROM courses WHERE semester = 1');
console.log(plan);
if (plan.includes('Index Scan') || plan.includes('idx_courses_semester')) {
  console.log('\n✅ Index is being used!');
} else {
  console.log('\n⚠️  Index not used (may be due to small table size)');
}

process.exit(0);
