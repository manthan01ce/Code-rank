import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function listOldUsers() {
  const DATABASE_URL = process.env.DATABASE_URL;
  const sql = neon(DATABASE_URL);
  try {
    const oldUsers = await sql`SELECT * FROM users_old_1776327332627`;
    console.log('Old Users in backup:', oldUsers);
  } catch (err) {
    console.error(err);
  }
}
listOldUsers();
