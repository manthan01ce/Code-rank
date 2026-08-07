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
    console.log('--- Initializing Unified Database Schema ---');
    
    // 1. Create users table
    console.log('Creating users table...');
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'faculty', 'student')),
        status TEXT NOT NULL DEFAULT 'active',
        extra_info JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Ensure first_name and last_name exist in users if table already existed
    const userColumns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `;
    const userColNames = userColumns.map(c => c.column_name);
    if (!userColNames.includes('first_name')) {
      console.log('Adding first_name to users...');
      await sql`ALTER TABLE users ADD COLUMN first_name VARCHAR(255)`;
    }
    if (!userColNames.includes('last_name')) {
      console.log('Adding last_name to users...');
      await sql`ALTER TABLE users ADD COLUMN last_name VARCHAR(255)`;
    }

    // 2. Create courses table
    console.log('Creating courses table...');
    await sql`
      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        course_code VARCHAR(100),
        name TEXT NOT NULL,
        description TEXT,
        semester INTEGER,
        assigned_faculty INTEGER,
        status TEXT NOT NULL DEFAULT 'ongoing',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Ensure course_code and semester exist in courses if table already existed
    const courseColumns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'courses'
    `;
    const courseColNames = courseColumns.map(c => c.column_name);
    if (!courseColNames.includes('course_code')) {
      console.log('Adding course_code to courses...');
      await sql`ALTER TABLE courses ADD COLUMN course_code VARCHAR(100)`;
    }
    if (!courseColNames.includes('semester')) {
      console.log('Adding semester to courses...');
      await sql`ALTER TABLE courses ADD COLUMN semester INTEGER`;
    }

    // 3. Create course_faculty junction mapping table
    console.log('Creating course_faculty mapping table...');
    await sql`
      CREATE TABLE IF NOT EXISTS course_faculty (
        course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
        faculty_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (course_id, faculty_id)
      )
    `;

    // Ensure is_co_coordinator exists in course_faculty if table already existed
    const courseFacColumns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'course_faculty'
    `;
    const cfColNames = courseFacColumns.map(c => c.column_name);
    if (!cfColNames.includes('is_co_coordinator')) {
      console.log('Adding is_co_coordinator to course_faculty...');
      await sql`ALTER TABLE course_faculty ADD COLUMN is_co_coordinator BOOLEAN DEFAULT FALSE`;
    }

    // Create unique index to guarantee at most one co-coordinator per course/subject
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_co_coordinator_unique 
      ON course_faculty (course_id) 
      WHERE is_co_coordinator = true
    `;

    // Create student_workspaces table
    console.log('Creating student_workspaces table...');
    await sql`
      CREATE TABLE IF NOT EXISTS student_workspaces (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        practical_id INTEGER NOT NULL REFERENCES practicals(id) ON DELETE CASCADE,
        language VARCHAR(50) NOT NULL,
        latest_code TEXT NOT NULL,
        saved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (student_id, practical_id, language)
      )
    `;

    // 4. Create activity_logs table
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

    // 5. Create problems table
    console.log('Creating problems table...');
    await sql`
      CREATE TABLE IF NOT EXISTS problems (
        id          SERIAL PRIMARY KEY,
        slug        TEXT UNIQUE NOT NULL,
        title       TEXT NOT NULL,
        difficulty  TEXT CHECK (difficulty IN ('Easy', 'Medium', 'Hard')) NOT NULL,
        description TEXT NOT NULL,
        entry       JSONB NOT NULL,
        constraints JSONB,
        created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // 6. Create test_cases table
    console.log('Creating test_cases table...');
    await sql`
      CREATE TABLE IF NOT EXISTS test_cases (
        id          SERIAL PRIMARY KEY,
        problem_id  INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
        input       JSONB NOT NULL,
        expected    JSONB NOT NULL,
        is_hidden   BOOLEAN DEFAULT FALSE,
        order_index INTEGER NOT NULL DEFAULT 0,
        show_output BOOLEAN DEFAULT FALSE,
        created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // 7. Create submissions table
    console.log('Creating submissions table...');
    await sql`
      CREATE TABLE IF NOT EXISTS submissions (
        id            SERIAL PRIMARY KEY,
        student_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        problem_id    INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
        source_code   TEXT NOT NULL,
        language      TEXT NOT NULL,
        status        TEXT NOT NULL,
        summary       TEXT NOT NULL,
        passed_count  INTEGER DEFAULT 0,
        total_count   INTEGER DEFAULT 0,
        runtime_ms    NUMERIC,
        compile_error TEXT,
        runtime_error TEXT,
        submitted_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // 8. Create submission_cases table
    console.log('Creating submission_cases table...');
    await sql`
      CREATE TABLE IF NOT EXISTS submission_cases (
        id            SERIAL PRIMARY KEY,
        submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
        test_case_id  INTEGER REFERENCES test_cases(id) ON DELETE SET NULL,
        case_index    INTEGER NOT NULL,
        is_hidden     BOOLEAN DEFAULT FALSE,
        status        TEXT NOT NULL,
        actual        JSONB,
        stdout        TEXT,
        stderr        TEXT,
        runtime_ms    NUMERIC,
        traceback     TEXT
      )
    `;

    // Ensure start_time and end_time exist in practicals
    try {
      const practicalColumns = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'practicals'
      `;
      const pracColNames = practicalColumns.map(c => c.column_name);
      if (pracColNames.length > 0) {
        if (!pracColNames.includes('start_time')) {
          console.log('Adding start_time to practicals...');
          await sql`ALTER TABLE practicals ADD COLUMN start_time TIMESTAMP WITH TIME ZONE`;
        }
        if (!pracColNames.includes('end_time')) {
          console.log('Adding end_time to practicals...');
          await sql`ALTER TABLE practicals ADD COLUMN end_time TIMESTAMP WITH TIME ZONE`;
        }
      }
    } catch (e) {
      console.log('Skipping practicals column checks (table may not exist yet):', e.message);
    }

    // Ensure is_late exists in practical_submissions
    try {
      const pracSubColumns = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'practical_submissions'
      `;
      const pracSubColNames = pracSubColumns.map(c => c.column_name);
      if (pracSubColNames.length > 0) {
        if (!pracSubColNames.includes('is_late')) {
          console.log('Adding is_late to practical_submissions...');
          await sql`ALTER TABLE practical_submissions ADD COLUMN is_late BOOLEAN DEFAULT FALSE`;
        }
      }
    } catch (e) {
      console.log('Skipping practical_submissions column checks:', e.message);
    }

    // 9. Create performance indexes
    console.log('Creating database indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON submissions(student_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_submissions_problem_id ON submissions(problem_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_course_faculty_ids ON course_faculty(course_id, faculty_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_practicals_course_id ON practicals(course_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_practical_submissions_student_id ON practical_submissions(student_id)`;

    // Seed admin if defined in .env
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (adminEmail && adminPassword) {
      console.log('Seeding admin user...');
      const hashedPassword = await hash(adminPassword, 10);
      try {
        await sql`
          INSERT INTO users (first_name, last_name, name, email, password, role, status)
          VALUES ('System', 'Admin', 'System Admin', ${adminEmail}, ${hashedPassword}, 'admin', 'active')
          ON CONFLICT (email) DO UPDATE SET password = ${hashedPassword}
        `;
        console.log('Admin user verified/seeded successfully.');
      } catch (e) {
        console.error('Failed to seed admin:', e.message);
      }
    }

    console.log('✅ Unified Database initialization and migrations completed successfully.');
  } catch (err) {
    console.error('❌ Database Initialization Error:', err);
  }
}

initDb();
