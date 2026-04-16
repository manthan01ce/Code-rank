import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function permanentDeleteStudent() {
  const sql = neon(process.env.DATABASE_URL);

  // Get student identifier from command line (email or ID)
  const identifier = process.argv[2];

  if (!identifier) {
    console.error('❌ Please provide student email or ID');
    console.log('Usage: node scripts/permanent_delete_student.js <email_or_id>');
    console.log('Example: node scripts/permanent_delete_student.js student@example.com');
    console.log('Example: node scripts/permanent_delete_student.js 123');
    process.exit(1);
  }

  try {
    // Check if identifier is a number (ID) or string (email)
    const isId = !isNaN(identifier);
    
    let student;
    if (isId) {
      student = await sql`SELECT * FROM users WHERE id = ${parseInt(identifier)} AND role = 'student'`;
    } else {
      student = await sql`SELECT * FROM users WHERE email = ${identifier} AND role = 'student'`;
    }

    if (student.length === 0) {
      console.error(`❌ No student found with ${isId ? 'ID' : 'email'}: ${identifier}`);
      process.exit(1);
    }

    const studentData = student[0];
    console.log('\n📋 Student to be permanently deleted:');
    console.log(`   ID: ${studentData.id}`);
    console.log(`   Name: ${studentData.name}`);
    console.log(`   Email: ${studentData.email}`);
    console.log(`   Status: ${studentData.status}`);
    console.log(`   Created: ${studentData.created_at}`);

    // Delete activity logs for this student first (foreign key constraint)
    const logsDeleted = await sql`DELETE FROM activity_logs WHERE user_id = ${studentData.id}`;
    console.log(`\n🗑️  Deleted ${logsDeleted.length} activity log(s)`);

    // Permanently delete the student
    const deleted = await sql`DELETE FROM users WHERE id = ${studentData.id} AND role = 'student' RETURNING *`;
    
    if (deleted.length > 0) {
      console.log(`\n✅ Student permanently deleted from database`);
      console.log(`   Name: ${deleted[0].name}`);
      console.log(`   Email: ${deleted[0].email}`);
    } else {
      console.error('❌ Failed to delete student');
    }

    // Show remaining student count
    const remaining = await sql`SELECT COUNT(*) FROM users WHERE role = 'student'`;
    console.log(`\n📊 Remaining students in database: ${remaining[0].count}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

permanentDeleteStudent().catch(console.error);
