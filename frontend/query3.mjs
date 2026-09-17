import sql from './src/lib/db.js';
async function run() {
  const p = await sql`SELECT id, title, course_id, batch_id, status FROM practicals`;
  console.log('PRACTICALS STATUS:', p);
  
  const studentId = 1262; // Manthan Raithatha, semester 3
  
  const practicals = await sql`
      SELECT p.id, p.title, p.status, c.semester
      FROM practicals p
      JOIN courses c ON p.course_id = c.id
      WHERE (p.batch_id = '' OR p.batch_id = 'All')
        AND c.semester = 3
        AND p.status = 'active'
  `;
  console.log('QUERY RESULT:', practicals);
  
  process.exit(0);
}
run();
