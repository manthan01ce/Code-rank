import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function listFaculty() {
  const sql = neon(process.env.DATABASE_URL);

  try {
    // Get all faculty
    const faculty = await sql`
      SELECT id, name, email, status, extra_info, created_at 
      FROM users 
      WHERE role = 'faculty' 
      ORDER BY created_at DESC
    `;

    console.log(`\n📊 Total Faculty: ${faculty.length}\n`);

    if (faculty.length === 0) {
      console.log('No faculty found in database.');
      return;
    }

    // Group by status
    const active = faculty.filter(f => f.status === 'active');
    const inactive = faculty.filter(f => f.status === 'inactive');

    if (active.length > 0) {
      console.log(`✅ ACTIVE FACULTY (${active.length}):`);
      console.log('─'.repeat(100));
      active.forEach((fac, index) => {
        const dept = fac.extra_info?.department || 'N/A';
        const desig = fac.extra_info?.designation || 'N/A';
        console.log(`${index + 1}. ID: ${fac.id} | ${fac.name} | ${fac.email}`);
        console.log(`   Department: ${dept} | Designation: ${desig}`);
        console.log(`   Created: ${new Date(fac.created_at).toLocaleString()}`);
      });
      console.log('');
    }

    if (inactive.length > 0) {
      console.log(`❌ INACTIVE FACULTY (${inactive.length}):`);
      console.log('─'.repeat(100));
      inactive.forEach((fac, index) => {
        const dept = fac.extra_info?.department || 'N/A';
        const desig = fac.extra_info?.designation || 'N/A';
        console.log(`${index + 1}. ID: ${fac.id} | ${fac.name} | ${fac.email}`);
        console.log(`   Department: ${dept} | Designation: ${desig}`);
        console.log(`   Created: ${new Date(fac.created_at).toLocaleString()}`);
      });
      console.log('');
    }

    console.log('\n💡 To permanently delete a faculty member, run:');
    console.log('   node scripts/permanent_delete_faculty.js <email_or_id>');
    console.log('\nExample:');
    console.log('   node scripts/permanent_delete_faculty.js faculty@example.com');
    console.log('   node scripts/permanent_delete_faculty.js 123\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

listFaculty().catch(console.error);
