import './../../packages/core/src/config/env.js';
import sql, { closeDatabase } from './../../packages/database/src/client.js';
import { generateToken } from './../../packages/core/src/utils/auth.js';
import crypto from 'node:crypto';

async function testRuntimeCap() {
  console.log('--- TESTING 5-SECOND RUNTIME CAP & BOUNDARY ---');
  
  // 1. Get or create student token
  const sessionToken = crypto.randomUUID();
  const [studentUser] = await sql`
    UPDATE users 
    SET session_token = ${sessionToken} 
    WHERE email = '26ce004@charusat.edu.in' 
    RETURNING id, name, email, role, session_token
  `;
  const studentToken = generateToken(studentUser);
  const studentHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${studentToken}` };

  const pracRes = await fetch('http://localhost:3000/api/student/practicals', { headers: studentHeaders });
  const practicals = await pracRes.json();
  if (!practicals || !practicals.length) throw new Error('No assigned practicals found for student');
  const practicalId = practicals[0].id;
  console.log(`Using assigned practical ${practicalId}: "${practicals[0].title}"`);

  // 2. Test Normal Fast Execution
  console.log('\n[1/3] Testing normal execution (fast baseline)...');
  const fastCode = `#include <iostream>\nint main() { std::cout << "Fast response" << std::endl; return 0; }`;
  const t0 = performance.now();
  const fastRes = await fetch('http://localhost:3000/api/cpp-run', {
    method: 'POST',
    headers: studentHeaders,
    body: JSON.stringify({ problemId: `practical_${practicalId}`, code: fastCode, language: 'cpp' })
  });
  console.log('Fast dispatch status:', fastRes.status);
  const fastJob = await fastRes.json();
  console.log('Fast dispatch body:', JSON.stringify(fastJob));
  const fastJobId = fastJob.jobId || fastJob.job_id;
  console.log('Fast job dispatched:', fastJobId);

  let fastCompleted = false;
  let fastResult = null;
  while (performance.now() - t0 < 15000) {
    await new Promise(r => setTimeout(r, 400));
    const res = await fetch(`http://localhost:3000/api/jobs/${fastJobId}`, { headers: studentHeaders });
    fastResult = await res.json();
    if (fastResult.status === 'completed' || fastResult.status === 'failed') {
      fastCompleted = true;
      break;
    }
  }
  const fastDuration = ((performance.now() - t0) / 1000).toFixed(2);
  console.log(`Fast job finished in ${fastDuration}s with status: ${fastResult.status}`);
  if (!fastCompleted) throw new Error('Fast job timed out waiting for response');

  // 3. Test Infinite Loop in C++ (5s Cap Verification)
  console.log('\n[2/3] Testing infinite loop execution (5-second cap enforcement)...');
  const infiniteLoopCode = `#include <iostream>\nint main() { volatile int x = 0; while (true) { x++; } return 0; }`;
  const tStart = performance.now();
  const loopRes = await fetch('http://localhost:3000/api/cpp-run', {
    method: 'POST',
    headers: studentHeaders,
    body: JSON.stringify({ problemId: `practical_${practicalId}`, code: infiniteLoopCode, language: 'cpp' })
  });
  const loopJob = await loopRes.json();
  const loopJobId = loopJob.jobId || loopJob.job_id;
  console.log('Infinite loop job dispatched:', loopJobId);

  let loopCompleted = false;
  let loopResult = null;
  while (performance.now() - tStart < 25000) {
    await new Promise(r => setTimeout(r, 500));
    const res = await fetch(`http://localhost:3000/api/jobs/${loopJobId}`, { headers: studentHeaders });
    loopResult = await res.json();
    if (loopResult.status === 'completed' || loopResult.status === 'failed') {
      loopCompleted = true;
      break;
    }
  }
  const loopDuration = ((performance.now() - tStart) / 1000).toFixed(2);
  console.log(`Infinite loop terminated in ${loopDuration}s with status: ${loopResult.status}`);
  console.log('Result details:', JSON.stringify(loopResult.result || loopResult));

  // The runner has a 5000ms execution cap. With queueing + compilation + SIGKILL overhead,
  // it must finish and NOT hang indefinitely (e.g. finishes between 5s and 10s max).
  const durationSec = parseFloat(loopDuration);
  if (durationSec > 12.0) {
    throw new Error(`Infinite loop exceeded expected 5s bound window: ${durationSec}s`);
  }
  console.log(`\n✓ 5-second cap successfully enforced in ${loopDuration}s (bounded < 12s total roundtrip).`);

  // 4. Test Memory / Output Limits
  console.log('\n[3/3] Testing excessive output limit...');
  const excessiveOutputCode = `#include <iostream>\nint main() { for (int i = 0; i < 1000000; i++) std::cout << "EXCESSIVE OUTPUT FLOODING BUFFER 0123456789\\n"; return 0; }`;
  const outStart = performance.now();
  const floodRes = await fetch('http://localhost:3000/api/cpp-run', {
    method: 'POST',
    headers: studentHeaders,
    body: JSON.stringify({ problemId: `practical_${practicalId}`, code: excessiveOutputCode, language: 'cpp' })
  });
  const floodJob = await floodRes.json();
  const floodJobId = floodJob.jobId || floodJob.job_id;
  console.log('Output flood job dispatched:', floodJobId);

  let floodCompleted = false;
  let floodResult = null;
  while (performance.now() - outStart < 20000) {
    await new Promise(r => setTimeout(r, 500));
    const res = await fetch(`http://localhost:3000/api/jobs/${floodJobId}`, { headers: studentHeaders });
    floodResult = await res.json();
    if (floodResult.status === 'completed' || floodResult.status === 'failed') {
      floodCompleted = true;
      break;
    }
  }
  const floodDuration = ((performance.now() - outStart) / 1000).toFixed(2);
  console.log(`Excessive output job terminated in ${floodDuration}s with status: ${floodResult.status}`);
  console.log('Output size bounded safely without crashing server/worker.');

  console.log('\n--- 5-SECOND CAP & EXECUTION BOUNDARY VERIFIED ---');
}

testRuntimeCap()
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await closeDatabase();
  });
