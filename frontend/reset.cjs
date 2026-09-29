require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const sql = neon(process.env.DATABASE_URL);

async function run() {
  const hash = await bcrypt.hash('password123', 10);
  await sql.query('UPDATE users SET password = $1 WHERE email = $2', [hash, '25ce02974@charusat.edu.in']);
  console.log('Password updated for 25ce02974@charusat.edu.in');
}
run().catch(console.error);
