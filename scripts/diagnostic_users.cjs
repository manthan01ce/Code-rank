const { neon } = require('@neondatabase/serverless');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function run() {
  const sql = neon(process.env.DATABASE_URL);
  try {
    const roles = await sql`
      SELECT role, status, COUNT(*)::int 
      FROM users 
      GROUP BY role, status
    `;
    console.log('Users role & status distribution:', roles);

    const courseStatuses = await sql`
      SELECT status, COUNT(*)::int 
      FROM courses 
      GROUP BY status
    `;
    console.log('Courses status distribution:', courseStatuses);

  } catch (err) {
    console.error(err.message);
  }
}
run();
