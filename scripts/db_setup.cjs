const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function main() {
  console.log('Starting DB Migration...');

  try {
    // 1. Add first_name and last_name to users if they don't exist
    console.log('Checking users table...');
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `;
    const colNames = columns.map(c => c.column_name);
    
    if (!colNames.includes('first_name')) {
      console.log('Adding first_name to users...');
      await sql`ALTER TABLE users ADD COLUMN first_name VARCHAR(255)`;
    }
    if (!colNames.includes('last_name')) {
      console.log('Adding last_name to users...');
      await sql`ALTER TABLE users ADD COLUMN last_name VARCHAR(255)`;
    }

    // Attempt to backfill first_name and last_name from name if name exists
    if (colNames.includes('name')) {
        console.log('Backfilling names...');
        // We do a simple split on space.
        await sql`
            UPDATE users 
            SET first_name = split_part(name, ' ', 1),
                last_name = CASE 
                                WHEN position(' ' in name) > 0 THEN substr(name, position(' ' in name) + 1)
                                ELSE '' 
                            END
            WHERE first_name IS NULL OR last_name IS NULL
        `;
    }

    // 2. Create course_faculty mapping table
    console.log('Creating course_faculty table...');
    await sql`
      CREATE TABLE IF NOT EXISTS course_faculty (
        course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
        faculty_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (course_id, faculty_id)
      )
    `;

    // 3. Trim students down to 50
    console.log('Trimming students...');
    const students = await sql`
      SELECT id FROM users WHERE role = 'student' ORDER BY created_at DESC
    `;
    
    if (students.length > 50) {
      const idsToDelete = students.slice(50).map(s => s.id);
      console.log(`Deleting ${idsToDelete.length} extra students...`);
      // Delete in chunks or just one IN clause if not too huge
      await sql`DELETE FROM users WHERE id = ANY(${idsToDelete})`;
      console.log('Trimmed students down to 50.');
    } else {
      console.log(`Only ${students.length} students found. No trimming needed.`);
    }

    // Also check what courses table has
    const courseColumns = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'courses'
    `;
    console.log('Course columns:', courseColumns.map(c => c.column_name).join(', '));
    // Usually courses might have description, let's keep it in DB but just not use it in UI, 
    // or make it nullable if we are changing it.

    console.log('Migration completed successfully!');

  } catch (error) {
    console.error('Migration failed:', error);
  }
}

main();
