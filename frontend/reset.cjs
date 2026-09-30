require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const sql = neon(process.env.DATABASE_URL);

async function run() {
  // Check current user
  const users = await sql.query(
    "SELECT id, name, email, role, status, LEFT(password, 10) as pw_preview FROM users WHERE email = $1",
    ['25ce02974@charusat.edu.in']
  );
  console.log('User found:', JSON.stringify(users, null, 2));

  if (users.length === 0) {
    console.log('USER NOT FOUND IN DB');
    return;
  }

  // Reset password to: Password@123
  const hash = await bcrypt.hash('Password@123', 10);
  await sql.query(
    'UPDATE users SET password = $1, status = $2 WHERE email = $3',
    [hash, 'active', '25ce02974@charusat.edu.in']
  );
  console.log('Password reset to: Password@123');
  console.log('Status set to: active');
}

run().catch(console.error);
