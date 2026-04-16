import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function permanentDeleteFaculty() {
  const sql = neon(process.env.DATABASE_URL);

  // Get faculty identifier from command line (email or ID)
  const identifier = process.argv[2];

  if (!identifier) {
    console.error('❌ Please provide faculty email or ID');
    console.log('Usage: node scripts/permanent_delete_faculty.js <email_or_id>');
    console.log('Example: node scripts/permanent_delete_faculty.js faculty@example.com');
    console.log('Example: node scripts/permanent_delete_faculty.js 123');
    process.exit(1);
  }

  try {
    // Check if identifier is a number (ID) or string (email)
    const isId = !isNaN(identifier);
    
    let faculty;
    if (isId) {
      faculty = await sql`SELECT * FROM users WHERE id = ${parseInt(identifier)} AND role = 'faculty'`;
    } else {
      faculty = await sql`SELECT * FROM users WHERE email ILIKE ${identifier} AND role = 'faculty'`;
    }

    if (faculty.length === 0) {
      console.error(`❌ No faculty found with ${isId ? 'ID' : 'email'}: ${identifier}`);
      process.exit(1);
    }

    const facultyData = faculty[0];
    console.log('\n📋 Faculty to be permanently deleted:');
    console.log(`   ID: ${facultyData.id}`);
    console.log(`   Name: ${facultyData.name}`);
    console.log(`   Email: ${facultyData.email}`);
    console.log(`   Status: ${facultyData.status}`);
    console.log(`   Department: ${facultyData.extra_info?.department || 'N/A'}`);
    console.log(`   Designation: ${facultyData.extra_info?.designation || 'N/A'}`);
    console.log(`   Created: ${facultyData.created_at}`);

    // Check if faculty is assigned to any courses
    const assignedCourses = await sql`SELECT id, name FROM courses WHERE assigned_faculty = ${facultyData.id}`;
    if (assignedCourses.length > 0) {
      console.log(`\n⚠️  This faculty is assigned to ${assignedCourses.length} course(s):`);
      assignedCourses.forEach((course, i) => {
        console.log(`   ${i + 1}. ${course.name} (ID: ${course.id})`);
      });
      console.log('   These courses will be unassigned.');
    }

    // Unassign from courses
    if (assignedCourses.length > 0) {
      await sql`UPDATE courses SET assigned_faculty = NULL WHERE assigned_faculty = ${facultyData.id}`;
      console.log(`\n✅ Unassigned from ${assignedCourses.length} course(s)`);
    }

    // Delete activity logs for this faculty first (foreign key constraint)
    const logsDeleted = await sql`DELETE FROM activity_logs WHERE user_id = ${facultyData.id}`;
    console.log(`🗑️  Deleted ${logsDeleted.length} activity log(s)`);

    // Permanently delete the faculty
    const deleted = await sql`DELETE FROM users WHERE id = ${facultyData.id} AND role = 'faculty' RETURNING *`;
    
    if (deleted.length > 0) {
      console.log(`\n✅ Faculty permanently deleted from database`);
      console.log(`   Name: ${deleted[0].name}`);
      console.log(`   Email: ${deleted[0].email}`);
    } else {
      console.error('❌ Failed to delete faculty');
    }

    // Show remaining faculty count
    const remaining = await sql`SELECT COUNT(*) FROM users WHERE role = 'faculty'`;
    console.log(`\n📊 Remaining faculty in database: ${remaining[0].count}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

permanentDeleteFaculty().catch(console.error);
