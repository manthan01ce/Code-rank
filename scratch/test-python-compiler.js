/**
 * scratch/test-python-compiler.js
 *
 * Automated verification suite for the production-grade Python execution engine.
 * Run directly using: node scratch/test-python-compiler.js
 */

import http from 'http';

const PORT = 3000;
const URL = `http://localhost:${PORT}/api/python-run`;

const TESTS = [
  {
    name: '1. Correct solution (Accepted)',
    payload: {
      code: `class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        mapping = {}
        for idx, val in enumerate(nums):
            diff = target - val
            if diff in mapping:
                return [mapping[diff], idx]
            mapping[val] = idx
        return []
`,
      problem: {
        entry: { type: 'class-method', className: 'Solution', methodName: 'twoSum' }
      },
      testCases: [
        { args: [[2, 7, 11, 15], 9], expected: [0, 1] },
        { args: [[3, 2, 4], 6], expected: [1, 2] }
      ]
    },
    verify: (res) => {
      if (res.status !== 'accepted') throw new Error(`Expected accepted, got: ${res.status}`);
      if (res.cases.length !== 2) throw new Error(`Expected 2 cases, got: ${res.cases.length}`);
      if (res.cases[0].status !== 'passed') throw new Error(`Case 1 status expected passed, got: ${res.cases[0].status}`);
      console.log('  -> OK');
    }
  },
  {
    name: '2. Syntax Error (Compile Error)',
    payload: {
      code: `class Solution:
    def twoSum(self, nums, target)
        return [0, 1]  # Missing colon after signature
`,
      problem: {
        entry: { type: 'class-method', className: 'Solution', methodName: 'twoSum' }
      },
      testCases: [
        { args: [[2, 7], 9], expected: [0, 1] }
      ]
    },
    verify: (res) => {
      if (res.status !== 'compile_error') throw new Error(`Expected compile_error, got: ${res.status}`);
      if (!res.compileError.includes('SyntaxError')) throw new Error(`Expected compileError to contain 'SyntaxError'`);
      console.log('  -> OK');
    }
  },
  {
    name: '3. Indentation Error (Compile Error)',
    payload: {
      code: `class Solution:
def twoSum(self, nums, target):
    return [0, 1]  # Incorrect indentation of method
`,
      problem: {
        entry: { type: 'class-method', className: 'Solution', methodName: 'twoSum' }
      },
      testCases: [
        { args: [[2, 7], 9], expected: [0, 1] }
      ]
    },
    verify: (res) => {
      if (res.status !== 'compile_error') throw new Error(`Expected compile_error, got: ${res.status}`);
      if (!res.compileError.includes('IndentationError')) throw new Error(`Expected compileError to contain 'IndentationError'`);
      console.log('  -> OK');
    }
  },
  {
    name: '4. Runtime Exception (runtime_error)',
    payload: {
      code: `class Solution:
    def twoSum(self, nums, target):
        return 1 / 0  # ZeroDivisionError
`,
      problem: {
        entry: { type: 'class-method', className: 'Solution', methodName: 'twoSum' }
      },
      testCases: [
        { args: [[2, 7], 9], expected: [0, 1] }
      ]
    },
    verify: (res) => {
      if (res.status !== 'runtime_error') throw new Error(`Expected runtime_error, got: ${res.status}`);
      if (res.cases[0].status !== 'runtime_error') throw new Error(`Expected case 1 status to be runtime_error`);
      if (!res.cases[0].traceback.includes('ZeroDivisionError')) throw new Error(`Expected traceback to contain ZeroDivisionError`);
      console.log('  -> OK');
    }
  },
  {
    name: '5. expected vs actual mismatch (Wrong Answer)',
    payload: {
      code: `class Solution:
    def twoSum(self, nums, target):
        return [9, 9]  # Incorrect result
`,
      problem: {
        entry: { type: 'class-method', className: 'Solution', methodName: 'twoSum' }
      },
      testCases: [
        { args: [[2, 7], 9], expected: [0, 1] }
      ]
    },
    verify: (res) => {
      if (res.status !== 'wrong_answer') throw new Error(`Expected wrong_answer, got: ${res.status}`);
      if (res.cases[0].status !== 'wrong_answer') throw new Error(`Expected case 1 status to be wrong_answer`);
      console.log('  -> OK');
    }
  },
  {
    name: '6. Output Normalization (Floats & Tuples)',
    payload: {
      code: `class Solution:
    def solve(self):
        return (0.333333333, (1, 2))  # Returns tuple and float
`,
      problem: {
        entry: { type: 'class-method', className: 'Solution', methodName: 'solve' }
      },
      testCases: [
        { args: [], expected: [0.33333333, [1, 2]] }
      ]
    },
    verify: (res) => {
      if (res.status !== 'accepted') throw new Error(`Expected accepted, got: ${res.status}`);
      console.log('  -> OK');
    }
  },
  {
    name: '7. Infinite Loop (Time Limit Exceeded - TLE)',
    payload: {
      code: `class Solution:
    def twoSum(self, nums, target):
        while True:
            pass  # Infinite loop
`,
      problem: {
        entry: { type: 'class-method', className: 'Solution', methodName: 'twoSum' }
      },
      testCases: [
        { args: [[2, 7], 9], expected: [0, 1] }
      ]
    },
    verify: (res) => {
      if (res.status !== 'time_limit_exceeded') throw new Error(`Expected time_limit_exceeded, got: ${res.status}`);
      console.log('  -> OK');
    }
  },
  {
    name: '8. Memory Intensive (Memory Limit Exceeded - MLE)',
    payload: {
      code: `class Solution:
    def twoSum(self, nums, target):
        # Progressively allocate 500MB to trigger OOM
        arr = [b"x" * 10_000_000 for _ in range(50)]
        return [0, 1]
`,
      problem: {
        entry: { type: 'class-method', className: 'Solution', methodName: 'twoSum' }
      },
      testCases: [
        { args: [[2, 7], 9], expected: [0, 1] }
      ]
    },
    verify: (res) => {
      if (res.status !== 'memory_limit_exceeded') throw new Error(`Expected memory_limit_exceeded, got: ${res.status}`);
      console.log('  -> OK');
    }
  }
];

function runPost(payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request(URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error(`Failed to parse body: ${body}`));
        }
      });
    });

    req.on('error', e => reject(e));
    req.write(data);
    req.end();
  });
}

async function start() {
  console.log('Starting execution harness verification...');
  for (const t of TESTS) {
    console.log(`Running test: ${t.name}`);
    try {
      const res = await runPost(t.payload);
      t.verify(res);
    } catch (err) {
      console.error(`  -> FAILED: ${err.message}`);
    }
  }
}

start();
