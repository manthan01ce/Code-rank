import http from 'http';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PORT = 3000;
const SUBMIT_URL = `http://localhost:${PORT}/api/submit`;

function makeRequest(url, payload, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
      'Authorization': `Bearer ${token}`
    };

    const req = http.request(url, {
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
          reject(new Error(`Failed parsing: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function test() {
  console.log('--- Starting Dashboard Submission & Compilation Verification ---');

  // Obtain student token
  const { default: sql } = await import('../src/lib/db.js');
  const students = await sql`SELECT * FROM users WHERE role = 'student' LIMIT 1`;
  if (students.length === 0) {
    console.error('No students found in database. Seed student first.');
    return;
  }
  const student = students[0];
  const jwt = await import('jsonwebtoken');
  const token = jwt.default.sign(
    { id: student.id, email: student.email, role: student.role },
    process.env.JWT_SECRET || 'fallback-secret',
    { expiresIn: '1h' }
  );

  // Test 1: Valid Solution submission (Problem 1)
  console.log('\nRunning Test 1: Submitting Valid Two Sum Solution (Problem 1)...');
  const validTwoSum = `class Solution:
    def twoSum(self, nums, target):
        mapping = {}
        for i, val in enumerate(nums):
            diff = target - val
            if diff in mapping:
                return [mapping[diff], i]
            mapping[val] = i
        return []
`;

  const res1 = await makeRequest(SUBMIT_URL, {
    problemId: 1,
    language: 'python',
    code: validTwoSum
  }, token);

  console.log('Test 1 Response Status:', res1.statusCode);
  console.log('Test 1 Response Payload:', res1.data);
  if (res1.data.status !== 'accepted' || res1.data.passed_count !== 5) {
    throw new Error('Test 1 failed to return accepted submission status');
  }
  console.log('  -> Test 1 Passed: Valid solution accepted with 5/5 cases.');

  // Test 2: Invalid/Broken syntax solution (Problem 1)
  console.log('\nRunning Test 2: Submitting Buggy Code with Standalone f (Problem 1)...');
  const buggyTwoSum = `class Solution:
    def twoSum(self, nums, target):
        pass
f`;

  const res2 = await makeRequest(SUBMIT_URL, {
    problemId: 1,
    language: 'python',
    code: buggyTwoSum
  }, token);

  console.log('Test 2 Response Status:', res2.statusCode);
  console.log('Test 2 Response Payload:', res2.data);
  if (res2.data.status !== 'compile_error' || !res2.data.compileError.includes('NameError')) {
    throw new Error('Test 2 failed to strictly enforce compile check validation');
  }
  console.log('  -> Test 2 Passed: Buggy solution correctly rejected with Compile Error status.');

  // Test 3: Valid Solution submission (Problem 2: Reverse String)
  console.log('\nRunning Test 3: Submitting Valid Reverse String Solution (Problem 2)...');
  const validReverseStr = `class Solution:
    def reverseString(self, s):
        s.reverse()
        return s
`;

  const res3 = await makeRequest(SUBMIT_URL, {
    problemId: 2,
    language: 'python',
    code: validReverseStr
  }, token);

  console.log('Test 3 Response Status:', res3.statusCode);
  console.log('Test 3 Response Payload:', res3.data);
  if (res3.data.status !== 'accepted' || res3.data.passed_count !== 5) {
    throw new Error('Test 3 failed to accept valid Problem 2 submission');
  }
  console.log('  -> Test 3 Passed: Valid problem 2 solution accepted.');

  console.log('\n--- All Static Submission & Compiler Checks Passed Successfully! ---');
}

test().catch((err) => {
  console.error('\nVerification failed:', err.message);
  process.exit(1);
});
