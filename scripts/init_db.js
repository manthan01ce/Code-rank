
import { neon } from '@neondatabase/serverless';
import pkg from 'bcryptjs';
const { hash } = pkg;
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function initDb() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL is not set in .env.local');
    return;
  }

  const sql = neon(DATABASE_URL);
  
  try {
    console.log('--- Initializing Database ---');
    
    const oldTableName = `users_old_${new Date().getTime()}`;
    try {
      await sql.query(`ALTER TABLE IF EXISTS users RENAME TO ${oldTableName}`);
      console.log(`Renamed old users table to ${oldTableName}`);
    } catch (e) {
      console.log('No existing users table to rename or rename failed:', e.message);
    }
    
    console.log('Creating users table...');
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'faculty', 'student')),
        status TEXT NOT NULL DEFAULT 'active',
        extra_info JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

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

    console.log('Creating activity_logs table...');
    await sql`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        action TEXT NOT NULL,
        details TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Seed admin if exists in .env
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (adminEmail && adminPassword) {
      console.log('Seeding admin user...');
      const hashedPassword = await hash(adminPassword, 10);
      try {
        await sql`
          INSERT INTO users (name, email, password, role, status)
          VALUES ('Admin', ${adminEmail}, ${hashedPassword}, 'admin', 'active')
          ON CONFLICT (email) DO UPDATE SET password = ${hashedPassword}
        `;
        console.log('Admin seeded successfully.');
      } catch (e) {
        console.error('Failed to seed admin:', e.message);
      }
    }

    console.log('Database initialization complete.');
  } catch (err) {
    console.error('Initialization Error:', err);
  }
}

initDb();
