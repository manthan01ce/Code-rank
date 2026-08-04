const { neon } = require('@neondatabase/serverless');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function find() {
  const DATABASE_URL = process.env.DATABASE_URL;
  const sql = neon(DATABASE_URL);

  try {
    // Find faculty Ishika
    const faculties = await sql`
      SELECT id, name, email FROM users WHERE role = 'faculty' AND name ILIKE '%Ishika%'
    `;
    
    if (faculties.length === 0) {
      console.log('No faculty named Ishika found.');
      return;
    }

    const faculty = faculties[0];
    console.log(`Faculty found: ${faculty.name} (Email: ${faculty.email}, ID: ${faculty.id})`);

    // Mapped courses
    const mapped = await sql`
      SELECT c.id, c.course_code, c.name, c.semester 
      FROM course_faculty cf 
      JOIN courses c ON cf.course_id = c.id
      WHERE cf.faculty_id = ${faculty.id}
    `;

    if (mapped.length === 0) {
      console.log('No courses mapped to this faculty.');
      return;
    }

    console.log('Mapped courses:');
    for (const c of mapped) {
      console.log(`- [${c.course_code}] ${c.name} (Semester: ${c.semester}, Course ID: ${c.id})`);
    }

    // Get semesters of mapped courses
    const semesters = mapped.map(c => c.semester);

    // Find active students in those semesters
    const students = await sql`
      SELECT id, name, email, extra_info FROM users 
      WHERE role = 'student' 
        AND status = 'active'
        AND (extra_info->>'semester')::int = ANY(${semesters})
      LIMIT 10
    `;

    console.log(`\nActive students in semesters [${semesters.join(', ')}]:`);
    for (const s of students) {
      console.log(`- Student: ${s.name}`);
      console.log(`  Email: ${s.email}`);
      console.log(`  Roll No: ${s.extra_info?.roll_number}`);
      console.log(`  Semester: ${s.extra_info?.semester}`);
      console.log(`  Batch: ${s.extra_info?.batch}`);
    }

  } catch (err) {
    console.error('Query failed:', err.message);
  }
}

find();
