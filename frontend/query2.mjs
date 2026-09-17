import sql from './src/lib/db.js';
async function run() {
  const users = await sql`SELECT id, name, extra_info FROM users WHERE role = 'student' AND extra_info->>'semester' IS NOT NULL`;
  console.log('STUDENTS WITH SEMESTER:', users);
  
  const p = await sql`SELECT id, title, course_id, batch_id, faculty_id FROM practicals`;
  console.log('PRACTICALS:', p);
  
  process.exit(0);
}
run();
