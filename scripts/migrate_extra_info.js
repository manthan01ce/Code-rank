
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function migrate() {
  const sql = neon(process.env.DATABASE_URL);
  try {
    console.log('Adding extra_info column...');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS extra_info JSONB`;
    console.log('Migration complete.');
  } catch (err) {
    console.error('Migration Error:', err);
  }
}

migrate();
