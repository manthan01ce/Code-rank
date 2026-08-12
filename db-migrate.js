import sql from './src/lib/db.js';

async function run() {
  try {
    await sql`ALTER TABLE student_workspaces ALTER COLUMN latest_code TYPE BYTEA USING convert_to(latest_code, 'UTF8')`;
    console.log('Migrated successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    process.exit(0);
  }
}
run();
