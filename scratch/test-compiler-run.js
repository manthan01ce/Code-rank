import http from 'http';

const PORT = 3000;
const COMPILER_URL = `http://localhost:${PORT}/api/practice-run`;

function makeRequest(url, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
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
  console.log('--- Starting Python Compiler Stdin Style Tests ---');

  // Test 1: Simple print with empty input
  console.log('\nRunning Test 1: print("Hello World") with empty input...');
  const res1 = await makeRequest(COMPILER_URL, {
    code: 'print("Hello World")',
    input: ''
  });
  if (res1.statusCode !== 200) throw new Error(`HTTP ${res1.statusCode}`);
  const data1 = res1.data;
  console.log('Test 1 Response:', data1);
  if (data1.status !== 'success' || data1.exitCode !== 0 || !data1.stdout.includes('Hello World')) {
    throw new Error('Test 1 failed.');
  }
  console.log('  -> Test 1 Passed!');

  // Test 2: Single input() call
  console.log('\nRunning Test 2: name = input("Enter name: "); print(f"Welcome, {name}!") (stdin: Alice)...');
  const res2 = await makeRequest(COMPILER_URL, {
    code: 'name = input("Enter name: "); print(f"Welcome, {name}!")',
    input: 'Alice'
  });
  if (res2.statusCode !== 200) throw new Error(`HTTP ${res2.statusCode}`);
  const data2 = res2.data;
  console.log('Test 2 Response:', data2);
  if (data2.status !== 'success' || data2.exitCode !== 0 || !data2.stdout.includes('Welcome, Alice!')) {
    throw new Error('Test 2 failed.');
  }
  console.log('  -> Test 2 Passed!');

  // Test 3: Multiple input() calls
  console.log('\nRunning Test 3: a = input(); b = input(); print(a, b) (stdin: Line1\\nLine2)...');
  const res3 = await makeRequest(COMPILER_URL, {
    code: 'a = input(); b = input(); print(a, b)',
    input: 'Line1\nLine2'
  });
  if (res3.statusCode !== 200) throw new Error(`HTTP ${res3.statusCode}`);
  const data3 = res3.data;
  console.log('Test 3 Response:', data3);
  if (data3.status !== 'success' || data3.exitCode !== 0 || !data3.stdout.includes('Line1 Line2')) {
    throw new Error('Test 3 failed.');
  }
  console.log('  -> Test 3 Passed!');

  // Test 4: sys.stdin.read() stream
  console.log('\nRunning Test 4: import sys; data = sys.stdin.read(); print(data) (stdin: multi-line text)...');
  const res4 = await makeRequest(COMPILER_URL, {
    code: 'import sys; data = sys.stdin.read(); print(data)',
    input: 'Line one\nLine two\nLine three'
  });
  if (res4.statusCode !== 200) throw new Error(`HTTP ${res4.statusCode}`);
  const data4 = res4.data;
  console.log('Test 4 Response:', data4);
  if (data4.status !== 'success' || data4.exitCode !== 0 || !data4.stdout.includes('Line two')) {
    throw new Error('Test 4 failed.');
  }
  console.log('  -> Test 4 Passed!');

  console.log('\n--- All Python Compiler Stdin Style Tests Passed Successfully! ---');
}

test().catch((err) => {
  console.error('\nVerification failed:', err.message);
  process.exit(1);
});
