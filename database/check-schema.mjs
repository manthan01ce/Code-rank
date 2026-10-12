#!/usr/bin/env node

import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env') });

const sql = neon(process.env.DATABASE_URL);

console.log('🔍 Checking Table Schema\n');

// Check courses table
const coursesSchema = await sql`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'courses'
  ORDER BY ordinal_position
`;
console.log('Courses table columns:');
coursesSchema.forEach(c => console.log(`  - ${c.column_name} (${c.data_type})`));

// Check if semester column exists and has data
const semesterData = await sql`SELECT semester, COUNT(*) FROM courses GROUP BY semester`;
console.log('\nSemester distribution:');
semesterData.forEach(s => console.log(`  Semester ${s.semester}: ${s.count} courses`));

// Try creating a simple test index
console.log('\n🧪 Test: Creating a simple index...');
try {
  await sql`CREATE INDEX test_idx_courses_semester ON courses(semester)`;
  console.log('✅ Successfully created test_idx_courses_semester');
  
  // Verify it exists
  const testCheck = await sql`
    SELECT indexname FROM pg_indexes 
    WHERE indexname = 'test_idx_courses_semester'
  `;
  console.log(`Verification: ${testCheck.length > 0 ? '✅ Found' : '❌ Not found'}`);
  
  // Clean up
  if (testCheck.length > 0) {
    await sql`DROP INDEX test_idx_courses_semester`;
    console.log('✅ Cleaned up test index');
  }
} catch (error) {
  console.log(`❌ Failed: ${error.message}`);
}

process.exit(0);
