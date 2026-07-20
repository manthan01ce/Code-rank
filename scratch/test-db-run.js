/**
 * scratch/test-db-run.js
 *
 * Automated verification suite for the database-backed Run API flow.
 * Run directly using: node scratch/test-db-run.js
 */

import http from 'http';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PORT = 3000;
const RUN_URL = `http://localhost:${PORT}/api/python-run`;

function makeRequest(payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
    };

    const req = http.request(RUN_URL, {
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
  console.log('--- Starting Database-Backed Run Flow Verification ---');

  // Test 1: Valid run (should fetch only 1 visible case from DB and run it)
  console.log('\nRunning Test 1: Valid Run Request...');
  const res1 = await makeRequest({
    problemId: 1,
    code: `class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        mapping = {}
        for idx, val in enumerate(nums):
            diff = target - val
            if diff in mapping:
                return [mapping[diff], idx]
            mapping[val] = idx
        return []
`
  });

  if (res1.statusCode !== 200) {
    throw new Error(`Expected HTTP 200, got ${res1.statusCode}: ${JSON.stringify(res1.data)}`);
  }

  const payload1 = res1.data;
  if (payload1.status !== 'accepted') {
    throw new Error(`Expected status accepted, got: ${payload1.status}`);
  }
  if (!payload1.cases || payload1.cases.length !== 1) {
    throw new Error(`Expected exactly 1 visible case to run, got: ${payload1.cases?.length}`);
  }
  if (payload1.cases[0].status !== 'passed') {
    throw new Error(`Expected case 1 status to be passed, got: ${payload1.cases[0].status}`);
  }
  console.log('  -> Test 1 Passed: Executed visible example successfully.');

  // Test 2: Invalid problem ID
  console.log('\nRunning Test 2: Invalid Problem ID...');
  const res2 = await makeRequest({
    problemId: 99999,
    code: 'print("hello")'
  });

  if (res2.statusCode !== 404) {
    throw new Error(`Expected HTTP 404, got ${res2.statusCode}`);
  }
  if (res2.data.success !== false || !res2.data.error.includes('not found')) {
    throw new Error(`Unexpected error response payload: ${JSON.stringify(res2.data)}`);
  }
  console.log('  -> Test 2 Passed: Correctly returned HTTP 404.');

  console.log('\n--- All Database-Backed Run Flow Verification Tests Passed Successfully! ---');
}

verify().catch((err) => {
  console.error('\nVerification failed:', err.message);
  process.exit(1);
});
