const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function reset() {
  const DATABASE_URL = process.env.DATABASE_URL;
  const sql = neon(DATABASE_URL);

  try {
    const passwordStr = 'Charusat@123';
    const hashedPassword = await bcrypt.hash(passwordStr, 10);

    const email = '25ce097@charusat.edu.in';
    const result = await sql`
      UPDATE users 
      SET password = ${hashedPassword} 
      WHERE email = ${email}
      RETURNING id, name, email
    `;

    if (result.length > 0) {
      console.log(`Successfully updated password for ${result[0].name} (${result[0].email}) to: ${passwordStr}`);
    } else {
      console.log(`Student with email ${email} not found.`);
    }
  } catch (err) {
    console.error('Password reset failed:', err.message);
  }
}

reset();
