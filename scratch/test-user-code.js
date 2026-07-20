import http from 'http';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PORT = 3000;
const RUN_URL = `http://localhost:${PORT}/api/python-run`;
const SUBMIT_URL = `http://localhost:${PORT}/api/submit`;

const userCode = `class Solution:
    def twoSum(self, nums, target):
        arr = []

        for i in range(len(nums)):
            arr.append((nums[i], i))

        arr.sort()

        left = 0
        right = len(arr) - 1

        while left < right:
            total = arr[left][0] + arr[right][0]

            if total == target:
                return [arr[left][1], arr[right][1]]
            elif total < target:
                left += 5
            else:
                right -= 1
`;

function makeRequest(url, payload, token = null) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

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
  console.log('--- Testing User Code Live Against Endpoints ---');

  // 1. Fetch token to use for submit
  // We can select the user from the db
  const { default: sql } = await import('../src/lib/db.js');
  const students = await sql`SELECT * FROM users WHERE role = 'student' LIMIT 1`;
  if (students.length === 0) {
    console.error('No students found. Run db_submit_setup.cjs first.');
    return;
  }
  const student = students[0];
  
  // Create a quick mock token
  const jwt = await import('jsonwebtoken');
  const token = jwt.default.sign(
    { id: student.id, email: student.email, role: student.role },
    process.env.JWT_SECRET || 'fallback-secret',
    { expiresIn: '1h' }
  );

  // Run Mode
  console.log('\n1. Sending User Code to RUN Mode (/api/python-run)...');
  const runRes = await makeRequest(RUN_URL, {
    problemId: 1,
    code: userCode
  });
  console.log('RUN status code:', runRes.statusCode);
  console.log('RUN response payload:', JSON.stringify(runRes.data, null, 2));

  // Submit Mode
  console.log('\n2. Sending User Code to SUBMIT Mode (/api/submit)...');
  const submitRes = await makeRequest(SUBMIT_URL, {
    problemId: 1,
    language: 'python',
    code: userCode
  }, token);
  console.log('SUBMIT status code:', submitRes.statusCode);
  console.log('SUBMIT response payload:', JSON.stringify(submitRes.data, null, 2));
}

test().catch(console.error);
