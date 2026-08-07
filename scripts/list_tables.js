import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function listTables() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL is not set');
    return;
  }
  const sql = neon(DATABASE_URL);
  try {
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    console.log('Tables in database:', tables.map(t => t.table_name));
  } catch (err) {
    console.error(err);
  }
}
listTables();
