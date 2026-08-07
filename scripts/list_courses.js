import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function listCourses() {
  const DATABASE_URL = process.env.DATABASE_URL;
  const sql = neon(DATABASE_URL);
  try {
    const courses = await sql`SELECT id, course_code, name FROM courses`;
    console.log('Courses in DB:', courses);
  } catch (err) {
    console.error(err);
  }
}
listCourses();
