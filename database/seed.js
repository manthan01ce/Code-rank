#!/usr/bin/env node
import '../packages/core/src/config/env.js';
import pg from 'pg';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const url = process.env.DATABASE_URL;
if (!url || /placeholder/.test(url)) {
  console.error('ERROR: Configure a valid DATABASE_URL in .env before running db:seed');
  process.exit(1);
}

const root = fileURLToPath(new URL('../', import.meta.url));
const sqlPath = resolve(root, 'database/init.sql');

if (!fs.existsSync(sqlPath)) {
  console.error('ERROR: database/init.sql not found at', sqlPath);
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, 'utf8');

console.log('Seeding database from database/init.sql...');
const client = new pg.Client({ connectionString: url });

try {
  await client.connect();
  await client.query(sql);

  // Restore search_path to public
  await client.query('SET search_path TO public;');

  // Check counts
  const res = await client.query(`
    SELECT 
      (SELECT count(*) FROM public.users)::int as users,
      (SELECT count(*) FROM public.courses)::int as courses,
      (SELECT count(*) FROM public.practicals)::int as practicals,
      (SELECT count(*) FROM public.departments)::int as departments,
      (SELECT count(*) FROM public.practical_test_cases)::int as test_cases
  `);
  const counts = res.rows[0];
  console.log('✅ Database seeded successfully:');
  console.log(`   - Users: ${counts.users}`);
  console.log(`   - Courses: ${counts.courses}`);
  console.log(`   - Practicals: ${counts.practicals}`);
  console.log(`   - Test Cases: ${counts.test_cases}`);
  console.log(`   - Departments: ${counts.departments}`);
} catch (error) {
  console.error('❌ Failed to seed database:', error.message);
  process.exit(1);
} finally {
  await client.end();
}
