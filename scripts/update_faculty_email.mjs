import sql from '../packages/database/src/client.js';

async function main() {
  const [user] = await sql`SELECT id, name, email, role FROM users WHERE id = 1295 OR email ILIKE '%riyapatel%'`;
  console.log('Current user 1295:', user);

  if (user) {
    const updated = await sql`
      UPDATE users 
      SET email = 'reyapatel@charusat.ac.in'
      WHERE id = ${user.id}
      RETURNING id, name, email, role, status
    `;
    console.log('Successfully updated user email:', updated);
  }
}

main().catch(err => {
  console.error('Error updating user email:', err);
  process.exit(1);
});
