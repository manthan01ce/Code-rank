import sql from './src/lib/db.js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const users = await sql`SELECT id, name, email, role, extra_info FROM users WHERE role = 'student'`;
  console.log('STUDENTS:', users);
  
  const courses = await sql`SELECT id, name, semester FROM courses`;
  console.log('COURSES:', courses);
  
  const practicals = await sql`SELECT id, title, course_id, batch_id, faculty_id FROM practicals`;
  console.log('PRACTICALS:', practicals);
  
  const courseFaculty = await sql`SELECT * FROM course_faculty`;
  console.log('COURSE_FACULTY:', courseFaculty);
  
  process.exit(0);
}

run();
