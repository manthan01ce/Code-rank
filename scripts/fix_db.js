import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function fixDatabase() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL is not set in .env.local');
    return;
  }

  const sql = neon(DATABASE_URL);
  
  try {
    console.log('--- Fixing Database Schema ---');
    
    // Add extra_info column if it doesn't exist
    console.log('Adding extra_info column to users table...');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS extra_info JSONB`;
    console.log('✓ extra_info column added');

    // Create courses table if it doesn't exist
    console.log('Creating courses table...');
    await sql`
      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        assigned_faculty INTEGER,
        status TEXT NOT NULL DEFAULT 'ongoing',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✓ courses table created');

    console.log('\n✅ Database schema fixed successfully!');
  } catch (err) {
    console.error('❌ Fix Database Error:', err);
  }
}

fixDatabase();
