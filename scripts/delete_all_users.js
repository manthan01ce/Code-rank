import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function deleteAllUsers() {
  const sql = neon(process.env.DATABASE_URL);

  console.log('🗑️  DELETING ALL STUDENTS AND FACULTY FROM DATABASE\n');
  console.log('⚠️  WARNING: This will permanently delete all non-admin users!');
  console.log('⚠️  Admin users will be preserved.\n');

  try {
    // Step 1: Count users before deletion
    console.log('📊 Current Database Status:');
    const beforeStats = await sql`
      SELECT role, status, COUNT(*) as count
      FROM users
      GROUP BY role, status
      ORDER BY role, status
    `;
    
    beforeStats.forEach(s => {
      console.log(`   ${s.role.padEnd(10)} | ${s.status.padEnd(10)} | ${s.count} users`);
    });
    console.log('');

    // Step 2: Get all students and faculty IDs
    const usersToDelete = await sql`
      SELECT id, name, email, role 
      FROM users 
      WHERE role IN ('student', 'faculty')
      ORDER BY role, name
    `;

    if (usersToDelete.length === 0) {
      console.log('✅ No students or faculty found. Database is already clean.');
      return;
    }

    console.log(`📋 Found ${usersToDelete.length} users to delete:\n`);
    
    const students = usersToDelete.filter(u => u.role === 'student');
    const faculty = usersToDelete.filter(u => u.role === 'faculty');

    if (students.length > 0) {
      console.log(`🎓 Students (${students.length}):`);
      students.forEach((s, i) => {
        console.log(`   ${i + 1}. ${s.name} (${s.email}) - ID: ${s.id}`);
      });
      console.log('');
    }

    if (faculty.length > 0) {
      console.log(`👨‍🏫 Faculty (${faculty.length}):`);
      faculty.forEach((f, i) => {
        console.log(`   ${i + 1}. ${f.name} (${f.email}) - ID: ${f.id}`);
      });
      console.log('');
    }

    // Step 3: Unassign faculty from courses
    console.log('🔗 Unassigning faculty from courses...');
    const facultyIds = faculty.map(f => f.id);
    if (facultyIds.length > 0) {
      const unassigned = await sql`
        UPDATE courses 
        SET assigned_faculty = NULL 
        WHERE assigned_faculty = ANY(${facultyIds})
        RETURNING id, name
      `;
      console.log(`   ✅ Unassigned ${unassigned.length} course(s)`);
    } else {
      console.log('   ℹ️  No faculty to unassign');
    }
    console.log('');

    // Step 4: Delete activity logs
    console.log('📝 Deleting activity logs...');
    const userIds = usersToDelete.map(u => u.id);
    const logsDeleted = await sql`
      DELETE FROM activity_logs 
      WHERE user_id = ANY(${userIds})
    `;
    console.log(`   ✅ Deleted ${logsDeleted.length} activity log(s)`);
    console.log('');

    // Step 5: Delete all students
    if (students.length > 0) {
      console.log('🗑️  Deleting students...');
      const deletedStudents = await sql`
        DELETE FROM users 
        WHERE role = 'student'
        RETURNING id, name, email
      `;
      console.log(`   ✅ Deleted ${deletedStudents.length} student(s)`);
    }

    // Step 6: Delete all faculty
    if (faculty.length > 0) {
      console.log('🗑️  Deleting faculty...');
      const deletedFaculty = await sql`
        DELETE FROM users 
        WHERE role = 'faculty'
        RETURNING id, name, email
      `;
      console.log(`   ✅ Deleted ${deletedFaculty.length} faculty member(s)`);
    }
    console.log('');

    // Step 7: Verify deletion
    console.log('✅ DELETION COMPLETE!\n');
    console.log('📊 Final Database Status:');
    const afterStats = await sql`
      SELECT role, status, COUNT(*) as count
      FROM users
      GROUP BY role, status
      ORDER BY role, status
    `;
    
    afterStats.forEach(s => {
      console.log(`   ${s.role.padEnd(10)} | ${s.status.padEnd(10)} | ${s.count} users`);
    });
    console.log('');

    // Step 8: Show remaining users (should only be admin)
    const remainingUsers = await sql`
      SELECT id, name, email, role 
      FROM users 
      ORDER BY role, name
    `;
    
    console.log('👥 Remaining Users:');
    remainingUsers.forEach((u, i) => {
      console.log(`   ${i + 1}. [${u.role.toUpperCase()}] ${u.name} (${u.email})`);
    });
    console.log('');

    console.log('═'.repeat(80));
    console.log('✅ Database is now clean and ready for deployment!');
    console.log('═'.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

deleteAllUsers().catch(console.error);
