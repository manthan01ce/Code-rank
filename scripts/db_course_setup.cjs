const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function main() {
  try {
    console.log('Adding course_code and semester to courses...');
    await sql`ALTER TABLE courses ADD COLUMN IF NOT EXISTS course_code VARCHAR(100)`;
    await sql`ALTER TABLE courses ADD COLUMN IF NOT EXISTS semester INTEGER`;
    console.log('Done!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

main();
