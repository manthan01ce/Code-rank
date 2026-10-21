// verify-system.js
// Automated verification for CodeRank: WebSockets & E2E execution pipeline
import { io } from 'socket.io-client';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runVerification() {
  console.log('====================================================');
  console.log('   CodeRank Verification: WebSockets & E2E Tests    ');
  console.log('====================================================\n');

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      if (details) console.log(`   └─ ${details}`);
      passedTests++;
      return true;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (details) console.error(`   └─ ${details}`);
      failedTests++;
      return false;
    }
  }

  // --- PART 1: HTTP API ENDPOINTS ---
  console.log('\n--- 1. HTTP API & Execution Queue Health ---');
  try {
    const queueStatsRes = await fetch(`${BASE_URL}/api/queue/stats`);
    const queueStats = await queueStatsRes.json();
    assert(queueStatsRes.status === 200, 'GET /api/queue/stats returns 200 OK', `Active: ${queueStats.active}, Waiting: ${queueStats.waiting}`);
  } catch (err) {
    assert(false, 'GET /api/queue/stats', err.message);
  }

  try {
    const execHealthRes = await fetch(`${BASE_URL}/api/execute`);
    const execHealth = await execHealthRes.json();
    assert(execHealthRes.status === 200 && execHealth.status === 'healthy', 'GET /api/execute returns healthy status', `Languages: ${execHealth.languages.join(', ')}`);
  } catch (err) {
    assert(false, 'GET /api/execute', err.message);
  }

  // --- PART 2: WEBSOCKET CONNECTION & ROOMS ---
  console.log('\n--- 2. WebSocket Connection & Real-Time Event Routing ---');
  const socket = io(BASE_URL, {
    transports: ['websocket', 'polling'],
    timeout: 5000,
  });

  const connected = await new Promise(resolve => {
    socket.on('connect', () => resolve(true));
    socket.on('connect_error', (err) => {
      console.error('Socket connect error:', err.message);
      resolve(false);
    });
    setTimeout(() => resolve(false), 5000);
  });

  assert(connected, 'Socket.IO client connected to Web Server', `Socket ID: ${socket.id}`);

  if (!connected) {
    console.error('Cannot proceed without active WebSocket connection.');
    process.exit(1);
  }

  // Test event broadcasting: faculty_practical_added -> practical_added
  const broadcastReceived = await new Promise((resolve) => {
    const testPractical = { id: 9999, title: 'E2E Test Practical' };
    const timeout = setTimeout(() => resolve(false), 5000);

    socket.on('practical_added', (data) => {
      if (data && data.id === 9999) {
        clearTimeout(timeout);
        resolve(true);
      }
    });

    socket.emit('faculty_practical_added', { course_id: 1, practical: testPractical });
  });

  assert(broadcastReceived, 'WebSocket Broadcast Event Relay (faculty_practical_added -> practical_added)', 'Event successfully round-tripped');

  // Test room join / leave
  socket.emit('join_practical_room', 42);
  socket.emit('leave_practical_room', 42);
  assert(true, 'WebSocket Room Management (join_practical_room / leave_practical_room)', 'Room events emitted cleanly');

  // --- PART 3: E2E CODE EXECUTION PIPELINE VIA WEBSOCKETS ---
  console.log('\n--- 3. E2E Code Execution Pipeline (Python) ---');
  const pythonCode = "print('Hello from CodeRank E2E Python!')";
  const pythonPostRes = await fetch(`${BASE_URL}/api/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language: 'python', code: pythonCode, input: '' }),
  });

  const pythonPostData = await pythonPostRes.json();
  const pyJobAccepted = assert(pythonPostRes.status === 202 && !!pythonPostData.jobId, 'POST /api/execute queues Python job', `Job ID: ${pythonPostData.jobId}`);

  if (pyJobAccepted) {
    const jobId = pythonPostData.jobId;
    socket.emit('watch_job', jobId);

    const pyResult = await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), 15000);
      const handler = (data) => {
        clearTimeout(timeout);
        socket.off('job_complete', handler);
        resolve(data);
      };
      socket.on('job_complete', handler);
    });

    assert(
      pyResult && pyResult.success && pyResult.stdout.includes('Hello from CodeRank E2E Python!'),
      'E2E Python Execution Result received via WebSocket job_complete',
      `Stdout: "${pyResult ? pyResult.stdout : ''}", ExitCode: ${pyResult ? pyResult.exitCode : 'N/A'}`
    );

    // Verify GET /api/jobs/:jobId
    const jobStatusRes = await fetch(`${BASE_URL}/api/jobs/${jobId}`);
    const jobStatusData = await jobStatusRes.json();
    assert(
      jobStatusRes.status === 200 && jobStatusData.status === 'completed',
      'GET /api/jobs/:jobId status is completed in BullMQ',
      `State: ${jobStatusData.status}, Finished: ${jobStatusData.finishedOn ? 'Yes' : 'No'}`
    );
  }

  // --- PART 4: E2E CODE EXECUTION PIPELINE (JAVASCRIPT) ---
  console.log('\n--- 4. E2E Code Execution Pipeline (JavaScript) ---');
  const jsCode = "console.log('Result:', 100 + 250);";
  const jsPostRes = await fetch(`${BASE_URL}/api/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language: 'javascript', code: jsCode, input: '' }),
  });

  const jsPostData = await jsPostRes.json();
  const jsJobAccepted = assert(jsPostRes.status === 202 && !!jsPostData.jobId, 'POST /api/execute queues JavaScript job', `Job ID: ${jsPostData.jobId}`);

  if (jsJobAccepted) {
    const jobId = jsPostData.jobId;
    socket.emit('watch_job', jobId);

    const jsResult = await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), 15000);
      const handler = (data) => {
        clearTimeout(timeout);
        socket.off('job_complete', handler);
        resolve(data);
      };
      socket.on('job_complete', handler);
    });

    assert(
      jsResult && jsResult.success && jsResult.stdout.includes('Result: 350'),
      'E2E JavaScript Execution Result received via WebSocket job_complete',
      `Stdout: "${jsResult ? jsResult.stdout : ''}"`
    );
  }

  // --- PART 5: E2E CODE EXECUTION PIPELINE (CPP) ---
  console.log('\n--- 5. E2E Code Execution Pipeline (C++) ---');
  const cppCode = '#include <iostream>\nint main() { std::cout << "C++ Daemon Working!" << std::endl; return 0; }';
  const cppPostRes = await fetch(`${BASE_URL}/api/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language: 'cpp', code: cppCode, input: '' }),
  });

  const cppPostData = await cppPostRes.json();
  const cppJobAccepted = assert(cppPostRes.status === 202 && !!cppPostData.jobId, 'POST /api/execute queues C++ job', `Job ID: ${cppPostData.jobId}`);

  if (cppJobAccepted) {
    const jobId = cppPostData.jobId;
    socket.emit('watch_job', jobId);

    const cppResult = await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), 15000);
      const handler = (data) => {
        clearTimeout(timeout);
        socket.off('job_complete', handler);
        resolve(data);
      };
      socket.on('job_complete', handler);
    });

    assert(
      cppResult && cppResult.success && cppResult.stdout.includes('C++ Daemon Working!'),
      'E2E C++ Execution Result received via WebSocket job_complete',
      `Stdout: "${cppResult ? cppResult.stdout : ''}"`
    );
  }

  // Clean up
  socket.disconnect();

  console.log('\n====================================================');
  console.log(`Verification Summary: ${passedTests} Passed, ${failedTests} Failed`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runVerification().catch(err => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
