
import { neon } from '@neondatabase/serverless';

async function checkDb() {
  const DATABASE_URL = 'postgresql://neondb_owner:npg_xfyu3nXC9EeJ@ep-shy-star-a4cmtjl2-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';
  const sql = neon(DATABASE_URL);
  
  try {
    console.log('--- Database Tables ---');
    const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    console.log(tables.map(t => t.table_name));
    
    if (tables.some(t => t.table_name === 'users')) {
      console.log('\n--- Users Table ---');
      const users = await sql`SELECT id, email, role, status FROM users`;
      console.log(users);
    } else {
      console.log('\nUsers table DOES NOT EXIST.');
    }

    if (tables.some(t => t.table_name === 'activity_logs')) {
       console.log('\nActivity logs table exists.');
    } else {
       console.log('\nActivity logs table DOES NOT EXIST.');
    }
  } catch (err) {
    console.error('DB Error:', err);
  }
}

checkDb();
