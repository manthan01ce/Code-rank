const { neon } = require('@neondatabase/serverless');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function setup() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL is not defined in .env.local');
    process.exit(1);
  }

  const sql = neon(DATABASE_URL);

  try {
    console.log('--- Initializing Practicals Schema ---');

    // 1. Create practicals table
    console.log('Creating practicals table...');
    await sql`
      CREATE TABLE IF NOT EXISTS practicals (
        id                 SERIAL PRIMARY KEY,
        faculty_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        course_id          INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        batch_id           VARCHAR(255) NOT NULL,
        title              VARCHAR(255) NOT NULL,
        description        TEXT NOT NULL,
        instructions       TEXT,
        total_marks        NUMERIC NOT NULL DEFAULT 0,
        max_test_cases     INTEGER DEFAULT 20,
        allow_partial_credit BOOLEAN DEFAULT TRUE,
        rejudge_on_change  BOOLEAN DEFAULT FALSE,
        difficulty         VARCHAR(50) DEFAULT 'Easy',
        is_challenge       BOOLEAN DEFAULT FALSE,
        starter_code       JSONB DEFAULT '{}'::jsonb,
        input_format       TEXT,
        output_format      TEXT,
        constraints        TEXT,
        sample_input       TEXT,
        sample_output      TEXT,
        status             VARCHAR(50) DEFAULT 'active',
        created_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // 2. Create practical_test_cases table
    console.log('Creating practical_test_cases table...');
    await sql`
      CREATE TABLE IF NOT EXISTS practical_test_cases (
        id             SERIAL PRIMARY KEY,
        practical_id   INTEGER NOT NULL REFERENCES practicals(id) ON DELETE CASCADE,
        input          TEXT NOT NULL,
        expected       TEXT NOT NULL,
        marks          NUMERIC NOT NULL DEFAULT 1 CHECK (marks >= 0),
        is_hidden      BOOLEAN DEFAULT FALSE,
        time_limit     NUMERIC,
        memory_limit   NUMERIC,
        order_index    INTEGER NOT NULL DEFAULT 0,
        label          VARCHAR(255),
        UNIQUE (practical_id, order_index)
      )
    `;

    // 3. Create practical_submissions table
    console.log('Creating practical_submissions table...');
    await sql`
      CREATE TABLE IF NOT EXISTS practical_submissions (
        id                SERIAL PRIMARY KEY,
        student_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        practical_id      INTEGER NOT NULL REFERENCES practicals(id) ON DELETE CASCADE,
        code              TEXT NOT NULL,
        language          VARCHAR(50) NOT NULL,
        status            VARCHAR(50) NOT NULL,
        raw_marks         NUMERIC NOT NULL DEFAULT 0,
        normalized_marks  NUMERIC NOT NULL DEFAULT 0 CHECK (normalized_marks >= 0 AND normalized_marks <= 10),
        execution_time_ms NUMERIC,
        memory_kb         NUMERIC,
        submitted_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // 4. Create practical_submission_cases table
    console.log('Creating practical_submission_cases table...');
    await sql`
      CREATE TABLE IF NOT EXISTS practical_submission_cases (
        id                SERIAL PRIMARY KEY,
        submission_id     INTEGER NOT NULL REFERENCES practical_submissions(id) ON DELETE CASCADE,
        test_case_id      INTEGER REFERENCES practical_test_cases(id) ON DELETE CASCADE,
        passed            BOOLEAN NOT NULL,
        marks_awarded     NUMERIC NOT NULL DEFAULT 0 CHECK (marks_awarded >= 0),
        actual_output     TEXT,
        error_message     TEXT,
        execution_time_ms NUMERIC,
        memory_kb         NUMERIC
      )
    `;

    // 5. Creating indexes for performance
    console.log('Creating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_practicals_course_batch_faculty ON practicals (course_id, batch_id, faculty_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_practical_submissions_practical_student ON practical_submissions (practical_id, student_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_practical_submissions_practical_submitted_at ON practical_submissions (practical_id, submitted_at)`;

    console.log('Practicals schema initialized successfully!');
  } catch (err) {
    console.error('Migration setup failed:', err.message);
    process.exit(1);
  }
}

setup();
