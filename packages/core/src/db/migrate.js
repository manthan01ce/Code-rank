/**
 * packages/core/src/db/migrate.js
 *
 * Idempotent schema migration for CodeRank PostgreSQL database.
 * Safe to run repeatedly; creates tables, columns, indexes, and constraints
 * without losing existing data.
 */
import 'dotenv/config';
import sql from './client.js';

export async function runMigrations() {
  console.log('🔄 [Migration] Starting idempotent schema migrations...');

  try {
    // 1. Users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'student',
        batch VARCHAR(50),
        semester INT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // 2. Courses table
    await sql`
      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        semester INT,
        academic_year VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // 3. Course Faculty mapping
    await sql`
      CREATE TABLE IF NOT EXISTS course_faculty (
        id SERIAL PRIMARY KEY,
        course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        faculty_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        is_co_coordinator BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_cf_course_faculty 
      ON course_faculty (course_id, faculty_id);
    `;

    // 4. Course Students mapping
    await sql`
      CREATE TABLE IF NOT EXISTS course_students (
        id SERIAL PRIMARY KEY,
        course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_cs_course_student 
      ON course_students (course_id, student_id);
    `;

    // 5. Practicals table
    await sql`
      CREATE TABLE IF NOT EXISTS practicals (
        id SERIAL PRIMARY KEY,
        course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        faculty_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        allowed_languages TEXT[] DEFAULT ARRAY['c','cpp','python','java','javascript'],
        total_marks NUMERIC DEFAULT 10,
        start_time TIMESTAMP WITH TIME ZONE,
        end_time TIMESTAMP WITH TIME ZONE,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // 6. Practical Test Cases table
    await sql`
      CREATE TABLE IF NOT EXISTS practical_test_cases (
        id SERIAL PRIMARY KEY,
        practical_id INT NOT NULL REFERENCES practicals(id) ON DELETE CASCADE,
        input TEXT,
        expected TEXT,
        marks NUMERIC DEFAULT 1,
        is_hidden BOOLEAN DEFAULT FALSE,
        order_index INT DEFAULT 0,
        label VARCHAR(100)
      );
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_ptc_practical_id 
      ON practical_test_cases (practical_id, order_index);
    `;

    // 7. Practical Submissions table
    await sql`
      CREATE TABLE IF NOT EXISTS practical_submissions (
        id SERIAL PRIMARY KEY,
        student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        practical_id INT NOT NULL REFERENCES practicals(id) ON DELETE CASCADE,
        code BYTEA NOT NULL,
        language VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'Submitted',
        raw_marks NUMERIC DEFAULT 0,
        normalized_marks NUMERIC DEFAULT 0,
        execution_time_ms NUMERIC DEFAULT 0,
        is_late BOOLEAN DEFAULT FALSE,
        submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // Clean up any historical duplicate submissions keeping the highest normalized marks
    await sql`
      DELETE FROM practical_submissions a
      USING practical_submissions b
      WHERE a.student_id = b.student_id
        AND a.practical_id = b.practical_id
        AND (a.normalized_marks < b.normalized_marks OR (a.normalized_marks = b.normalized_marks AND a.id < b.id));
    `;

    // Idempotent UNIQUE constraint on (student_id, practical_id)
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_practical_submissions_student_practical 
      ON practical_submissions (student_id, practical_id);
    `;

    // 8. Submission Cases (detailed test case results per submission)
    await sql`
      CREATE TABLE IF NOT EXISTS practical_submission_cases (
        id SERIAL PRIMARY KEY,
        submission_id INT NOT NULL REFERENCES practical_submissions(id) ON DELETE CASCADE,
        test_case_id INT NOT NULL REFERENCES practical_test_cases(id) ON DELETE CASCADE,
        passed BOOLEAN NOT NULL DEFAULT FALSE,
        marks_awarded NUMERIC DEFAULT 0,
        actual_output TEXT,
        error_message TEXT,
        execution_time_ms NUMERIC DEFAULT 0
      );
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_psc_submission_id 
      ON practical_submission_cases (submission_id);
    `;

    // 9. Submission Attempts (audit log of every run/submit attempt)
    await sql`
      CREATE TABLE IF NOT EXISTS submission_attempts (
        id SERIAL PRIMARY KEY,
        student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        practical_id INT NOT NULL REFERENCES practicals(id) ON DELETE CASCADE,
        code BYTEA NOT NULL,
        language VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        raw_marks NUMERIC DEFAULT 0,
        normalized_marks NUMERIC DEFAULT 0,
        execution_time_ms NUMERIC DEFAULT 0,
        is_late BOOLEAN DEFAULT FALSE,
        attempt_number INT DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_attempts_student_practical 
      ON submission_attempts (student_id, practical_id, created_at);
    `;

    // 10. Student Workspaces (autosave state)
    await sql`
      CREATE TABLE IF NOT EXISTS student_workspaces (
        id SERIAL PRIMARY KEY,
        student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        practical_id INT NOT NULL REFERENCES practicals(id) ON DELETE CASCADE,
        language VARCHAR(50) NOT NULL,
        latest_code BYTEA,
        saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sw_student_practical_lang 
      ON student_workspaces (student_id, practical_id, language);
    `;

    // 11. Activity logs
    await sql`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        user_id INT,
        action VARCHAR(100) NOT NULL,
        details JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    console.log('✅ [Migration] Idempotent schema migrations completed successfully.');
    return { success: true };
  } catch (err) {
    console.error('❌ [Migration] Error executing schema migrations:', err);
    throw err;
  }
}

// Allow direct execution: `node packages/core/src/db/migrate.js`
if (process.argv[1] && process.argv[1].endsWith('migrate.js')) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
