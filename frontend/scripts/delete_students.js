import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function deleteStudents() {
  const sql = neon(process.env.DATABASE_URL);

  // Check count first
  const before = await sql`SELECT COUNT(*) FROM users WHERE role = 'student'`;
  console.log(`Students before deletion: ${before[0].count}`);

  // Delete activity logs for students first (foreign key safety)
  const studentIds = await sql`SELECT id FROM users WHERE role = 'student'`;
  if (studentIds.length > 0) {
    const ids = studentIds.map(s => s.id);
    await sql`DELETE FROM activity_logs WHERE user_id = ANY(${ids})`;
    console.log(`Deleted activity logs for ${ids.length} students`);
  }

  // Permanently delete all students
  const deleted = await sql`DELETE FROM users WHERE role = 'student' RETURNING id, name, email`;
  console.log(`✅ Deleted ${deleted.length} students`);

  const after = await sql`SELECT COUNT(*) FROM users WHERE role = 'student'`;
  console.log(`Students after deletion: ${after[0].count}`);
}

deleteStudents().catch(console.error);
