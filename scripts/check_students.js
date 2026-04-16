import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkStudents() {
  const sql = neon(process.env.DATABASE_URL);
  const count = await sql`SELECT COUNT(*) FROM users WHERE role = 'student'`;
  console.log(`Students in database: ${count[0].count}`);
}

checkStudents().catch(console.error);
