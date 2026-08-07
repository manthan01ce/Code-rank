import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function verifySemesters() {
  const DATABASE_URL = process.env.DATABASE_URL;
  const sql = neon(DATABASE_URL);
  try {
    const courses = await sql`SELECT id, course_code, name, semester FROM courses`;
    console.log('Courses Semesters:', courses);

    const practicals = await sql`
      SELECT p.id, p.title, p.course_id, c.semester as course_semester
      FROM practicals p
      JOIN courses c ON p.course_id = c.id
    `;
    console.log('Practicals Semesters:', practicals);
  } catch (err) {
    console.error(err);
  }
}
verifySemesters();
