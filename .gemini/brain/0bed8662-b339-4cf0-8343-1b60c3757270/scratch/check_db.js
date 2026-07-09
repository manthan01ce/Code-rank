
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkDb() {
  const sql = neon(process.env.DATABASE_URL);
  try {
    const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    console.log('Tables:', tables);
    
    if (tables.some(t => t.table_name === 'users')) {
      const users = await sql`SELECT id, email, role, status FROM users`;
      console.log('Users:', users);
    } else {
      console.log('Users table does not exist.');
    }
  } catch (err) {
    console.error('DB Error:', err);
  }
}

checkDb();
