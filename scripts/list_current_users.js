import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function listUsers() {
  const DATABASE_URL = process.env.DATABASE_URL;
  const sql = neon(DATABASE_URL);
  try {
    const users = await sql`SELECT id, name, email, role, created_at FROM users ORDER BY id ASC`;
    console.log('Current Users:', users);
  } catch (err) {
    console.error(err);
  }
}
listUsers();
