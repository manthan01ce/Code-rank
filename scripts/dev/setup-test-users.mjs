/**
 * Setup test users: hash a known password and write to DB via postgres CLI
 * Run: node scripts/dev/setup-test-users.mjs
 */
import { createHash, randomBytes } from 'crypto';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env file
const envPath = path.join(__dirname, '..', '..', '.env');
const envContent = readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

const TEST_PASSWORD = 'LoadTest@2024';

// Use bcrypt via the auth utils
const { hashPassword } = await import('../../packages/core/src/utils/auth.js');

async function main() {
  console.log('🔧 Setting up test users for load testing...');
  console.log(`   Test password: ${TEST_PASSWORD}`);

  const hashed = await hashPassword(TEST_PASSWORD);
  console.log('✓ Password hashed:', hashed.substring(0, 20) + '...');

  // Use psql via docker to update passwords
  const escapedHash = hashed.replace(/'/g, "''");
  
  const updateStudentsSQL = `UPDATE users SET password = '${escapedHash}' WHERE role = 'student' AND status = 'active' RETURNING id, email;`;
  const updateFacultySQL = `UPDATE users SET password = '${escapedHash}' WHERE role = 'faculty' AND status = 'active' RETURNING id, email;`;

  console.log('\n📝 Updating student passwords in DB...');
  const studentResult = execSync(
    `docker exec coderank-postgres psql -U postgres -d coderank_local -t -c "${updateStudentsSQL}"`,
    { encoding: 'utf8' }
  );
  const studentLines = studentResult.trim().split('\n').filter(l => l.trim());
  console.log(`✓ Updated ${studentLines.length} student accounts`);

  console.log('📝 Updating faculty passwords in DB...');
  const facultyResult = execSync(
    `docker exec coderank-postgres psql -U postgres -d coderank_local -t -c "${updateFacultySQL}"`,
    { encoding: 'utf8' }
  );
  const facultyLines = facultyResult.trim().split('\n').filter(l => l.trim());
  console.log(`✓ Updated ${facultyLines.length} faculty accounts`);

  // Get student list for k6
  const listResult = execSync(
    `docker exec coderank-postgres psql -U postgres -d coderank_local -t -c "SELECT email FROM users WHERE role='student' AND status='active' ORDER BY id LIMIT 100;"`,
    { encoding: 'utf8' }
  );
  const emails = listResult.trim().split('\n').map(l => l.trim()).filter(l => l && l.includes('@'));
  
  const studentsJson = emails.map(email => ({ email, password: TEST_PASSWORD }));
  const outputPath = path.join(__dirname, '..', '..', 'load-tests', 'students.local.json');
  writeFileSync(outputPath, JSON.stringify(studentsJson, null, 2));
  console.log(`\n✓ Wrote ${studentsJson.length} students to load-tests/students.local.json`);

  // Get faculty list
  const facultyListResult = execSync(
    `docker exec coderank-postgres psql -U postgres -d coderank_local -t -c "SELECT id, email FROM users WHERE role='faculty' AND status='active' ORDER BY id LIMIT 5;"`,
    { encoding: 'utf8' }
  );
  const facultyRows = facultyListResult.trim().split('\n').filter(l => l.trim() && l.includes('@'));

  console.log('\n📋 Test Accounts Ready:');
  console.log(`   Password for ALL: ${TEST_PASSWORD}`);
  console.log(`   Faculty accounts:`);
  facultyRows.slice(0, 3).forEach(r => console.log(`     ${r.trim()}`));
  console.log(`   Student sample: ${emails[0]}`);
  console.log(`   Total students: ${emails.length}`);
  console.log('\n✅ Test users setup complete!');
}

main().catch(e => { console.error('Error:', e); process.exit(1); });
