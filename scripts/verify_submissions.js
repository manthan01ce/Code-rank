import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function verifySubmissions() {
  const DATABASE_URL = process.env.DATABASE_URL;
  const sql = neon(DATABASE_URL);
  try {
    const studentSubStats = await sql`
      SELECT student_id, count(*) 
      FROM submissions 
      GROUP BY student_id
    `;
    console.log('Compiler Submissions Grouped by Student ID:', studentSubStats);

    const practicalSubStats = await sql`
      SELECT student_id, count(*) 
      FROM practical_submissions 
      GROUP BY student_id
    `;
    console.log('Practical Submissions Grouped by Student ID:', practicalSubStats);

    // Check if these student_ids exist in users table
    const allStudentIds = [...new Set([
      ...studentSubStats.map(s => s.student_id),
      ...practicalSubStats.map(s => s.student_id)
    ])];

    if (allStudentIds.length > 0) {
      const existingUsers = await sql`
        SELECT id, name, email 
        FROM users 
        WHERE id = ANY(${allStudentIds})
      `;
      console.log('Existing users matching submission student_ids:', existingUsers);
      
      const missingIds = allStudentIds.filter(id => !existingUsers.some(u => u.id === id));
      console.log('Missing Student IDs (not found in users):', missingIds);
    }
  } catch (err) {
    console.error(err);
  }
}
verifySubmissions();
