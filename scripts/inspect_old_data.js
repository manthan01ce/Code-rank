import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function inspect() {
  const DATABASE_URL = process.env.DATABASE_URL;
  const sql = neon(DATABASE_URL);
  try {
    const u1 = await sql`SELECT count(*) FROM users`;
    console.log('Current users count:', u1[0].count);

    const u2 = await sql`SELECT count(*) FROM users_old_1776327806308`;
    console.log('users_old_1776327806308 count:', u2[0].count);

    const u3 = await sql`SELECT count(*) FROM users_old_1776327332627`;
    console.log('users_old_1776327332627 count:', u3[0].count);

    const sample = await sql`SELECT id, name, email, role FROM users_old_1776327806308 LIMIT 5`;
    console.log('Sample from users_old_1776327806308:', sample);
  } catch (err) {
    console.error(err);
  }
}
inspect();
