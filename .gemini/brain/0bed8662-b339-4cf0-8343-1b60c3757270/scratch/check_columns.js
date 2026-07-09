
import { neon } from '@neondatabase/serverless';

async function checkColumns() {
  const DATABASE_URL = 'postgresql://neondb_owner:npg_xfyu3nXC9EeJ@ep-shy-star-a4cmtjl2-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';
  const sql = neon(DATABASE_URL);
  
  try {
    console.log('--- Columns in users table ---');
    const columns = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'`;
    console.log(columns);
  } catch (err) {
    console.error('DB Error:', err);
  }
}

checkColumns();
