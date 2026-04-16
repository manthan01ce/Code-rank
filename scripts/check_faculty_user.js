import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkFacultyUser() {
  const sql = neon(process.env.DATABASE_URL);
  const email = '25CE097@charusat.edu.in';

  console.log(`\n🔍 Checking user: ${email}\n`);

  try {
    const user = await sql`SELECT * FROM users WHERE email ILIKE ${email}`;

    if (user.length > 0) {
      console.log('✅ User FOUND:');
      console.log('─'.repeat(80));
      const u = user[0];
      console.log(`ID:         ${u.id}`);
      console.log(`Name:       ${u.name}`);
      console.log(`Email:      ${u.email}`);
      console.log(`Role:       ${u.role} ⚠️`);
      console.log(`Status:     ${u.status}`);
      console.log(`Created:    ${u.created_at}`);
      console.log(`Extra Info: ${JSON.stringify(u.extra_info, null, 2)}`);
      console.log('─'.repeat(80));
      
      console.log('\n💡 ISSUE IDENTIFIED:');
      console.log(`   This user exists as a ${u.role.toUpperCase()}, not a student!`);
      console.log(`   That's why it doesn't appear in the Students list.`);
      console.log(`   Check the Faculty page to see this user.`);
      
      console.log('\n🔧 SOLUTIONS:');
      console.log('   1. If this should be a student, change their role:');
      console.log(`      UPDATE users SET role = 'student' WHERE id = ${u.id};`);
      console.log('   2. If this is correct, check the Faculty page instead');
      console.log('   3. If you want to delete this user:');
      console.log(`      node scripts/permanent_delete_student.js ${u.id}`);
    }

    // List all faculty
    console.log('\n📋 All Faculty in Database:');
    const allFaculty = await sql`
      SELECT id, name, email, status 
      FROM users 
      WHERE role = 'faculty'
      ORDER BY email
    `;
    
    allFaculty.forEach((f, i) => {
      const highlight = f.email.toLowerCase().includes('25ce097') ? ' ⚠️ ← THIS ONE' : '';
      console.log(`  ${i + 1}. [${f.status.toUpperCase()}] ${f.name} (${f.email}) - ID: ${f.id}${highlight}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkFacultyUser().catch(console.error);
