import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function listStudents() {
  const sql = neon(process.env.DATABASE_URL);

  try {
    // Get all students
    const students = await sql`
      SELECT id, name, email, status, created_at 
      FROM users 
      WHERE role = 'student' 
      ORDER BY created_at DESC
    `;

    console.log(`\n📊 Total Students: ${students.length}\n`);

    if (students.length === 0) {
      console.log('No students found in database.');
      return;
    }

    // Group by status
    const active = students.filter(s => s.status === 'active');
    const inactive = students.filter(s => s.status === 'inactive');

    if (active.length > 0) {
      console.log(`✅ ACTIVE STUDENTS (${active.length}):`);
      console.log('─'.repeat(80));
      active.forEach((student, index) => {
        console.log(`${index + 1}. ID: ${student.id} | ${student.name} | ${student.email}`);
        console.log(`   Created: ${new Date(student.created_at).toLocaleString()}`);
      });
      console.log('');
    }

    if (inactive.length > 0) {
      console.log(`❌ INACTIVE STUDENTS (${inactive.length}):`);
      console.log('─'.repeat(80));
      inactive.forEach((student, index) => {
        console.log(`${index + 1}. ID: ${student.id} | ${student.name} | ${student.email}`);
        console.log(`   Created: ${new Date(student.created_at).toLocaleString()}`);
      });
      console.log('');
    }

    console.log('\n💡 To permanently delete a student, run:');
    console.log('   node scripts/permanent_delete_student.js <email_or_id>');
    console.log('\nExample:');
    console.log('   node scripts/permanent_delete_student.js student@example.com');
    console.log('   node scripts/permanent_delete_student.js 123\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

listStudents().catch(console.error);
