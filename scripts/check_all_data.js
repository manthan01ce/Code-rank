import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function check() {
  const DATABASE_URL = process.env.DATABASE_URL;
  const sql = neon(DATABASE_URL);
  try {
    const c = await sql`SELECT count(*) FROM courses`;
    const p = await sql`SELECT count(*) FROM practicals`;
    const s = await sql`SELECT count(*) FROM submissions`;
    const ps = await sql`SELECT count(*) FROM practical_submissions`;
    console.log('Courses:', c[0].count);
    console.log('Practicals:', p[0].count);
    console.log('Compiler Submissions:', s[0].count);
    console.log('Practical Submissions:', ps[0].count);

    if (parseInt(p[0].count) > 0) {
      const sampleP = await sql`SELECT * FROM practicals LIMIT 2`;
      console.log('Sample Practical:', sampleP);
    }
  } catch (err) {
    console.error(err);
  }
}
check();
