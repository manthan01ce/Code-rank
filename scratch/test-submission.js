/**
 * scratch/test-submission.js
 *
 * Automated verification suite for the backend Submit Flow with hidden test cases.
 * Run directly using: node scratch/test-submission.js
 */

import http from 'http';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PORT = 3000;
const SUBMIT_URL = `http://localhost:${PORT}/api/submit`;

// Helper to make POST request with optional Auth Header
function makeRequest(payload, token = null) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(SUBMIT_URL, {
      method: 'POST',
      headers,
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            data: body ? JSON.parse(body) : null
          });
        } catch {
          reject(new Error(`Failed to parse response body: ${body}`));
        }
      });
    });

    req.on('error', e => reject(e));
    req.write(data);
    req.end();
  });
}

async function verify() {
  const { default: sql } = await import('../src/lib/db.js');
  const { generateToken } = await import('../src/lib/auth.js');

  console.log('--- Starting Submit Flow Verification Tests ---');

  // 1. Get or create a student user
  console.log('Fetching student user from database...');
  let students = await sql`SELECT * FROM users WHERE role = 'student' LIMIT 1`;
  let student;
  
  if (students.length === 0) {
    console.log('No student user found. Seeding a temporary student...');
    const inserted = await sql`
      INSERT INTO users (name, email, password, role, status)
      VALUES ('Test Student', 'student_temp@coderank.com', 'hashed_pass', 'student', 'active')
      RETURNING *
    `;
    student = inserted[0];
  } else {
    student = students[0];
  }
  console.log(`Using student: ${student.name} (${student.email})`);

  // Generate JWT token
  const token = generateToken(student);

  // 2. Test 1: Unauthorized submission (no token)
  console.log('\nRunning Test 1: Unauthorized Submission (No Token)...');
  const res1 = await makeRequest({
    problemId: 1,
    language: 'python',
    code: 'class Solution:\n    def twoSum(self, nums, target):\n        return [0,1]'
  });
  
  if (res1.statusCode !== 401) {
    throw new Error(`Expected HTTP 401, got ${res1.statusCode}`);
  }
  if (res1.data.success !== false || !res1.data.error.includes('Unauthorized')) {
    throw new Error(`Unexpected error response payload: ${JSON.stringify(res1.data)}`);
  }
  console.log('  -> Test 1 Passed: Correctly returned HTTP 401 Unauthorized.');

  // 3. Test 2: Correct submission (Accepted)
  console.log('\nRunning Test 2: Correct Submission (Accepted)...');
  const correctCode = `class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        mapping = {}
        for idx, val in enumerate(nums):
            diff = target - val
            if diff in mapping:
                return [mapping[diff], idx]
            mapping[val] = idx
        return []
`;
  const res2 = await makeRequest({
    problemId: 1,
    language: 'python',
    code: correctCode
  }, token);

  if (res2.statusCode !== 200) {
    throw new Error(`Expected HTTP 200, got ${res2.statusCode}: ${JSON.stringify(res2.data)}`);
  }
  
  const payload2 = res2.data;
  if (payload2.status !== 'accepted') {
    console.error('Test 2 payload failure details:', JSON.stringify(payload2, null, 2));
    throw new Error(`Expected status accepted, got: ${payload2.status}`);
  }
  if (payload2.passed_count !== 15 || payload2.total_count !== 15) {
    throw new Error(`Expected 15/15 passed cases, got: ${payload2.passed_count}/${payload2.total_count}`);
  }

  // Check hidden cases masking
  const cases2 = payload2.cases;
  if (cases2[0].hidden !== false || cases2[0].input === null || cases2[0].expected === null) {
    throw new Error('Case 1 (visible) should not be masked!');
  }
  if (cases2[2].hidden !== true || cases2[2].input !== null || cases2[2].expected !== null || cases2[2].stdout !== null) {
    throw new Error('Case 3 (hidden) MUST be masked!');
  }
  if (cases2[3].hidden !== true || cases2[3].input !== null || cases2[3].expected !== null || cases2[3].stdout !== null) {
    throw new Error('Case 4 (hidden) MUST be masked!');
  }
  console.log('  -> Test 2 Passed: Code accepted, 15/15 cases passed, hidden cases correctly masked.');

  // 4. Test 3: Wrong submission (Wrong Answer)
  console.log('\nRunning Test 3: Incorrect Submission (Wrong Answer)...');
  const wrongCode = `class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        # Only works for [2,7,11,15] target 9 -> returns [0,1]
        # Fails for target 6
        if target == 9:
            return [0, 1]
        return [99, 99]
`;
  const res3 = await makeRequest({
    problemId: 1,
    language: 'python',
    code: wrongCode
  }, token);

  if (res3.statusCode !== 200) {
    throw new Error(`Expected HTTP 200, got ${res3.statusCode}`);
  }

  const payload3 = res3.data;
  if (payload3.status !== 'wrong_answer') {
    throw new Error(`Expected status wrong_answer, got: ${payload3.status}`);
  }
  if (payload3.passed_count !== 1 || payload3.total_count !== 15) {
    throw new Error(`Expected 1/15 passed cases, got: ${payload3.passed_count}/${payload3.total_count}`);
  }
  
  // Verify cases 2 and 3 failed, and hidden cases are still masked
  const cases3 = payload3.cases;
  if (cases3[0].status !== 'passed' || cases3[0].hidden !== false) {
    throw new Error('Case 1 should have passed');
  }
  if (cases3[2].status !== 'wrong_answer' || cases3[2].hidden !== true || cases3[2].actual !== null) {
    throw new Error('Case 3 should have failed with wrong_answer and been masked');
  }
  if (cases3[3].status !== 'wrong_answer' || cases3[3].hidden !== true || cases3[3].actual !== null) {
    throw new Error('Case 4 should have failed with wrong_answer and been masked');
  }
  console.log('  -> Test 3 Passed: Code wrong, 1/15 cases passed, failed cases correctly mapped & masked.');

  // 5. Test 4: Compilation Error (Syntax/standalone token 'f')
  console.log('\nRunning Test 4: Compilation Error (Syntax/standalone f)...');
  const compileErrorCode = `class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        pass
f`;
  const res4 = await makeRequest({
    problemId: 1,
    language: 'python',
    code: compileErrorCode
  }, token);

  if (res4.statusCode !== 200) {
    throw new Error(`Expected HTTP 200, got ${res4.statusCode}`);
  }

  const payload4 = res4.data;
  if (payload4.status !== 'compile_error') {
    throw new Error(`Expected status compile_error, got: ${payload4.status}`);
  }
  if (!payload4.compileError || !payload4.compileError.includes('NameError')) {
    throw new Error(`Expected compileError trace with NameError, got: ${payload4.compileError}`);
  }
  if (payload4.cases.length !== 0) {
    throw new Error(`Expected 0 cases executed on compile failure, got: ${payload4.cases.length}`);
  }
  console.log('  -> Test 4 Passed: Code with standalone f correctly caught as compile_error.');

  // ── Cleanup temporary student if created ──
  if (students.length === 0) {
    console.log('\nCleaning up seeded temporary student user...');
    await sql`DELETE FROM users WHERE id = ${student.id}`;
  }

  console.log('\n--- All Submit Flow Verification Tests Passed Successfully! ---');
}

verify().catch((err) => {
  console.error('\nVerification failed:', err.message);
  process.exit(1);
});
