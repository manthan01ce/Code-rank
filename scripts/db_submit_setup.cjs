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
    console.log('--- Initializing Submit Flow Schema ---');

    // 1. Create problems table
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

    // 2. Create test_cases table
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

    // 3. Create submissions table
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

    // 4. Create submission_cases table
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

    // 5. Seed Two Sum Problem
    console.log('Seeding "1. Two Sum" problem...');
    const problems = await sql`
      INSERT INTO problems (slug, title, difficulty, description, entry, constraints)
      VALUES (
        'two-sum',
        '1. Two Sum',
        'Easy',
        'Given an array of integers <code>nums</code> and an integer <code>target</code>, return <em>indices of the two numbers such that they add up to <code>target</code></em>.<br/><br/>You may assume that each input would have <strong>exactly one solution</strong>, and you may not use the same element twice.<br/><br/>You can return the answer in any order.',
        '{"type": "class-method", "className": "Solution", "methodName": "twoSum"}'::jsonb,
        '["2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9", "-10^9 <= target <= 10^9", "Only one valid answer exists."]'::jsonb
      )
      ON CONFLICT (slug) DO UPDATE
      SET title = EXCLUDED.title,
          difficulty = EXCLUDED.difficulty,
          description = EXCLUDED.description,
          entry = EXCLUDED.entry,
          constraints = EXCLUDED.constraints
      RETURNING id
    `;

    const problemId = problems[0].id;
    console.log(`Problem seeded with ID: ${problemId}. Seeding test cases...`);

    // Clean old test cases for a fresh seed
    await sql`DELETE FROM test_cases WHERE problem_id = ${problemId}`;

    const testCasesToSeed = [
      // Visible Example Cases
      { input: { args: [[2, 7, 11, 15], 9] }, expected: [0, 1], is_hidden: false, order: 1, show_output: true },
      { input: { args: [[3, 2, 4], 6] }, expected: [1, 2], is_hidden: false, order: 2, show_output: true },

      // Hidden Test Cases (All Edge Cases)
      { input: { args: [[3, 3], 6] }, expected: [0, 1], is_hidden: true, order: 3, show_output: false },
      { input: { args: [[1, 5, 8, 10, 14, 18], 18] }, expected: [2, 3], is_hidden: true, order: 4, show_output: false },
      { input: { args: [[-1, -2, -3, -4, -5], -8] }, expected: [2, 4], is_hidden: true, order: 5, show_output: false },
      { input: { args: [[0, 4, 3, 0], 0] }, expected: [0, 3], is_hidden: true, order: 6, show_output: false },
      { input: { args: [[1000000000, 3, 5, 1000000000], 2000000000] }, expected: [0, 3], is_hidden: true, order: 7, show_output: false },
      { input: { args: [[10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 190] }, expected: [8, 9], is_hidden: true, order: 8, show_output: false },
      { input: { args: [[2, 5, 5, 11], 10] }, expected: [1, 2], is_hidden: true, order: 9, show_output: false },
      { input: { args: [[-10, 0, 10, -20, 20], 0] }, expected: [0, 2], is_hidden: true, order: 10, show_output: false },
      { input: { args: [[1, 2, 3, 4, 5, 6, 7, 8, 9, 15, 25, 30, 42, 55, 67, 100], 125] }, expected: [10, 15], is_hidden: true, order: 11, show_output: false },
      { input: { args: [[5, 25, 75, 125, 250, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 128000, 256000, 512000], 512005] }, expected: [0, 15], is_hidden: true, order: 12, show_output: false },
      { input: { args: [[1, 3, 9, 27, 81, 243, 729, 2187, 6561, 19683, 59049, 177147, 531441, 1594323, 4782969], 4782970] }, expected: [0, 14], is_hidden: true, order: 13, show_output: false },
      // Large array sequential verification (100 items)
      { input: { args: [Array.from({ length: 100 }, (_, i) => i + 1), 199] }, expected: [98, 99], is_hidden: true, order: 14, show_output: false },
      // Extreme performance scaling (1000 items)
      { input: { args: [Array.from({ length: 1000 }, (_, i) => i + 1), 1999] }, expected: [998, 999], is_hidden: true, order: 15, show_output: false },
    ];

    console.log(`Inserting ${testCasesToSeed.length} test cases...`);
    for (const tc of testCasesToSeed) {
      await sql`
        INSERT INTO test_cases (problem_id, input, expected, is_hidden, order_index, show_output)
        VALUES (${problemId}, ${JSON.stringify(tc.input)}, ${JSON.stringify(tc.expected)}, ${tc.is_hidden}, ${tc.order}, ${tc.show_output})
      `;
    }

    console.log('Seeding complete. Schema initialized successfully.');
  } catch (err) {
    console.error('Migration setup failed:', err.message);
    process.exit(1);
  }
}

setup();
