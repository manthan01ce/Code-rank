import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function verifyUsers() {
  const DATABASE_URL = process.env.DATABASE_URL;
  const sql = neon(DATABASE_URL);
  try {
    const students = await sql`
      SELECT id, name, email, extra_info 
      FROM users 
      WHERE id IN (1262, 1271, 1276)
    `;
    console.log('Students extra_info:', students);
  } catch (err) {
    console.error(err);
  }
}
verifyUsers();
