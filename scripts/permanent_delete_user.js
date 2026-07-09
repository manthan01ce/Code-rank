import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function permanentDeleteUser() {
  const sql = neon(process.env.DATABASE_URL);

  // Get user identifier from command line (email or ID)
  const identifier = process.argv[2];

  if (!identifier) {
    console.error('❌ Please provide user email or ID');
    console.log('Usage: node scripts/permanent_delete_user.js <email_or_id>');
    console.log('Example: node scripts/permanent_delete_user.js user@example.com');
    console.log('Example: node scripts/permanent_delete_user.js 123');
    console.log('\nThis script works for both students and faculty.');
    process.exit(1);
  }

  try {
    // Check if identifier is a number (ID) or string (email)
    const isId = !isNaN(identifier);
    
    let user;
    if (isId) {
      user = await sql`SELECT * FROM users WHERE id = ${parseInt(identifier)} AND role != 'admin'`;
    } else {
      user = await sql`SELECT * FROM users WHERE email ILIKE ${identifier} AND role != 'admin'`;
    }

    if (user.length === 0) {
      console.error(`❌ No user found with ${isId ? 'ID' : 'email'}: ${identifier}`);
      console.log('Note: Admin users cannot be deleted with this script.');
      process.exit(1);
    }

    const userData = user[0];
    const isStudent = userData.role === 'student';
    const isFaculty = userData.role === 'faculty';

    console.log(`\n📋 ${userData.role.toUpperCase()} to be permanently deleted:`);
    console.log(`   ID: ${userData.id}`);
    console.log(`   Name: ${userData.name}`);
    console.log(`   Email: ${userData.email}`);
    console.log(`   Role: ${userData.role}`);
    console.log(`   Status: ${userData.status}`);
    
    if (isStudent) {
      console.log(`   Roll Number: ${userData.extra_info?.roll_number || 'N/A'}`);
      console.log(`   Branch: ${userData.extra_info?.branch || 'N/A'}`);
      console.log(`   Batch: ${userData.extra_info?.batch || 'N/A'}`);
    } else if (isFaculty) {
      console.log(`   Department: ${userData.extra_info?.department || 'N/A'}`);
      console.log(`   Designation: ${userData.extra_info?.designation || 'N/A'}`);
    }
    
    console.log(`   Created: ${userData.created_at}`);

    // Check if faculty is assigned to any courses
    if (isFaculty) {
      const assignedCourses = await sql`SELECT id, name FROM courses WHERE assigned_faculty = ${userData.id}`;
      if (assignedCourses.length > 0) {
        console.log(`\n⚠️  This faculty is assigned to ${assignedCourses.length} course(s):`);
        assignedCourses.forEach((course, i) => {
          console.log(`   ${i + 1}. ${course.name} (ID: ${course.id})`);
        });
        console.log('   These courses will be unassigned.');
        
        // Unassign from courses
        await sql`UPDATE courses SET assigned_faculty = NULL WHERE assigned_faculty = ${userData.id}`;
        console.log(`\n✅ Unassigned from ${assignedCourses.length} course(s)`);
      }
    }

    // Delete activity logs for this user first (foreign key constraint)
    const logsDeleted = await sql`DELETE FROM activity_logs WHERE user_id = ${userData.id}`;
    console.log(`🗑️  Deleted ${logsDeleted.length} activity log(s)`);

    // Permanently delete the user
    const deleted = await sql`DELETE FROM users WHERE id = ${userData.id} AND role != 'admin' RETURNING *`;
    
    if (deleted.length > 0) {
      console.log(`\n✅ ${userData.role.toUpperCase()} permanently deleted from database`);
      console.log(`   Name: ${deleted[0].name}`);
      console.log(`   Email: ${deleted[0].email}`);
    } else {
      console.error('❌ Failed to delete user');
    }

    // Show remaining count
    const remaining = await sql`SELECT COUNT(*) FROM users WHERE role = ${userData.role}`;
    console.log(`\n📊 Remaining ${userData.role}s in database: ${remaining[0].count}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

permanentDeleteUser().catch(console.error);
