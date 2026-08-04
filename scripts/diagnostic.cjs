const { neon } = require('@neondatabase/serverless');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function run() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL is not defined');
    return;
  }
  const sql = neon(DATABASE_URL);

  try {
    const usersCount = await sql`SELECT COUNT(*)::int as count FROM users`;
    const coursesCount = await sql`SELECT COUNT(*)::int as count FROM courses`;
    const departmentsCount = await sql`SELECT COUNT(*)::int as count FROM departments`;
    const logsCount = await sql`SELECT COUNT(*)::int as count FROM activity_logs`;
    const practicalsCount = await sql`SELECT COUNT(*)::int as count FROM practicals`;
    
    console.log('--- DATABASE DIAGNOSTIC ---');
    console.log(`Users: ${usersCount[0].count}`);
    console.log(`Courses: ${coursesCount[0].count}`);
    console.log(`Departments: ${departmentsCount[0].count}`);
    console.log(`Activity Logs: ${logsCount[0].count}`);
    console.log(`Practicals: ${practicalsCount[0].count}`);

    const courses = await sql`SELECT * FROM courses LIMIT 5`;
    console.log('\nSample Courses:', courses);

    const practicals = await sql`SELECT * FROM practicals LIMIT 5`;
    console.log('\nSample Practicals:', practicals);
  } catch (err) {
    console.error('Diagnostic failed:', err.message);
  }
}

run();
