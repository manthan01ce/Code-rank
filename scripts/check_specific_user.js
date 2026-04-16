import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkUser() {
  const sql = neon(process.env.DATABASE_URL);
  const email = '25ce097@charusat.edu.in';

  console.log(`\n🔍 Searching for user: ${email}\n`);

  try {
    // Check if user exists
    const user = await sql`SELECT * FROM users WHERE email = ${email}`;

    if (user.length === 0) {
      console.log('❌ User NOT found in database');
      console.log('\nChecking for similar emails...');
      const similar = await sql`SELECT email FROM users WHERE email ILIKE ${'%' + email.split('@')[0] + '%'}`;
      if (similar.length > 0) {
        console.log('Found similar emails:');
        similar.forEach(u => console.log(`  - ${u.email}`));
      }
    } else {
      console.log('✅ User FOUND in database:');
      console.log('─'.repeat(80));
      const u = user[0];
      console.log(`ID:         ${u.id}`);
      console.log(`Name:       ${u.name}`);
      console.log(`Email:      ${u.email}`);
      console.log(`Role:       ${u.role}`);
      console.log(`Status:     ${u.status}`);
      console.log(`Created:    ${u.created_at}`);
      console.log(`Extra Info: ${JSON.stringify(u.extra_info, null, 2)}`);
      console.log('─'.repeat(80));
    }

    // Check all users count
    console.log('\n📊 Database Statistics:');
    const stats = await sql`
      SELECT 
        role,
        status,
        COUNT(*) as count
      FROM users
      GROUP BY role, status
      ORDER BY role, status
    `;
    
    stats.forEach(s => {
      console.log(`  ${s.role.padEnd(10)} | ${s.status.padEnd(10)} | ${s.count} users`);
    });

    // List all students
    console.log('\n📋 All Students in Database:');
    const allStudents = await sql`
      SELECT id, name, email, status, created_at 
      FROM users 
      WHERE role = 'student'
      ORDER BY created_at DESC
    `;
    
    if (allStudents.length === 0) {
      console.log('  No students found');
    } else {
      allStudents.forEach((s, i) => {
        console.log(`  ${i + 1}. [${s.status.toUpperCase()}] ${s.name} (${s.email}) - ID: ${s.id}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkUser().catch(console.error);
