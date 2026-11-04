// Disposable Compose acceptance. Never selects developer volumes or resets a database.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { io } from 'socket.io-client';
import { once } from 'node:events';
import { mkdirSync, writeFileSync } from 'node:fs';
import { checkDeployment } from '../lib/deployment-readiness.mjs';
import { successfulExecution } from '../../load-tests/lib/execution-result.js';

const suffix = randomBytes(6).toString('hex');
const project = `coderank_ci_${suffix}`;
const env = { ...process.env, POSTGRES_DB: 'coderank_test', POSTGRES_USER: 'postgres', POSTGRES_PASSWORD: randomBytes(24).toString('hex'), DATABASE_DRIVER: 'postgres', JWT_SECRET: randomBytes(48).toString('hex'), CODERANK_REDIS_VOLUME: `${project}_redis`, CODERANK_POSTGRES_VOLUME: `${project}_postgres`, SANDBOX_SCOPE: `ci-${suffix}`, ALLOWED_ORIGIN: 'http://127.0.0.1:3310', REALTIME_URL: 'http://api:3001', MAX_CONCURRENT_JOBS: '2' };
env.DATABASE_URL = `postgresql://postgres:${env.POSTGRES_PASSWORD}@postgres:5432/coderank_test`;
const args = ['compose', '-p', project, '-f', 'infrastructure/docker-compose.yml', '-f', 'infrastructure/compose.containers.yaml', '-f', 'infrastructure/compose.ci.yaml', '--profile', 'local-database'];
const compose = extra => execFileSync('docker', [...args, ...extra], { env, stdio: 'inherit', timeout: 180000 });
const base = 'http://127.0.0.1:3310';
const pause = ms => new Promise(done => setTimeout(done, ms));
let socket;
try {
  compose(['config', '--quiet']);
  const resolved = JSON.parse(execFileSync('docker', [...args, 'config', '--format', 'json'], { env, encoding: 'utf8' }));
  for (const service of ['api', 'web', 'worker', 'gateway']) assert.equal(resolved.services[service].profiles?.length || 0, 0, `${service} must start without an extra profile in full-container mode`);
  compose(['up', '-d', '--no-build', '--wait', 'redis', 'postgres']);
  const hostDatabase = new URL(env.DATABASE_URL); hostDatabase.hostname = '127.0.0.1'; hostDatabase.port = '5439';
  const migration = spawnSync(process.execPath, ['database/run-migration.js'], { env: { ...env, DATABASE_URL: hostDatabase.href }, stdio: 'inherit', timeout: 60000 });
  assert.equal(migration.status, 0, 'controlled release migration must finish before applications start');
  compose(['up', '-d', '--no-build', 'api', 'web', 'worker', 'gateway']);
  const running = execFileSync('docker', [...args, 'ps', '--services', '--status', 'running'], { env, encoding: 'utf8' }).trim().split(/\s+/);
  for (const service of ['api', 'web', 'worker', 'gateway']) assert.ok(running.includes(service), `${service} must run in the full topology`);
  let readiness;
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    try { readiness = await checkDeployment(base); break; } catch {}
    await pause(500);
  }
  assert.equal(readiness?.status, 'healthy', 'container API/database/Redis/worker must become ready');
  const login = await fetch(`${base}/login`); assert.equal(login.status, 200); assert.match(await login.text(), /CodeRank|Sign|Login/i);
  const directApiUnknown = await fetch(`${base}/api/unknown-final-route`); assert.equal(directApiUnknown.status, 404);
  const response = await fetch(`${base}/api/execute`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ language: 'python', code: "import time\ntime.sleep(1)\nprint('container-topology')" }) });
  assert.equal(response.status, 202);
  const job = await response.json(); assert.ok(job.jobId);
  const cookie = response.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie?.startsWith('coderank_execution_session='));
  socket = io(base, { transports: ['websocket'], extraHeaders: { cookie }, reconnection: false, timeout: 5000 });
  await once(socket, 'connect');
  let event;
  socket.on('job_complete', value => { if (value.jobId === job.jobId) event = value; });
  assert.equal((await socket.timeout(5000).emitWithAck('watch_job', job.jobId)).ok, true);
  let result;
  const jobDeadline = Date.now() + 45000;
  while (Date.now() < jobDeadline) {
    const stateResponse = await fetch(`${base}/api/jobs/${job.jobId}`, { headers: { cookie } }); assert.equal(stateResponse.status, 200);
    const state = await stateResponse.json();
    if (state.status === 'completed') { result = state; break; }
    assert.notEqual(state.status, 'failed'); await pause(150);
  }
  assert.ok(successfulExecution(result, 'container-topology'));
  for (let attempt = 0; attempt < 20 && !event; attempt++) await pause(100);
  assert.ok(event, 'worker must publish real completion through gateway WebSocket');
  assert.equal((await fetch(`${base}/api/jobs/${job.jobId}`, { headers: { cookie: `coderank_execution_session=${randomBytes(32).toString('hex')}` } })).status, 403);
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/container-topology.json', JSON.stringify({ status: 'passed', standardWeb: true, api: true, worker: true, gateway: true, websocket: true, guestOwnership: true })+'\n');
  console.log('Container topology passed: independent standard Next.js, API, worker, gateway, controlled migrations, real sandbox execution, WebSocket delivery and guest ownership');
} catch (error) {
  compose(['logs', '--no-color', '--tail', '100']);
  throw error;
} finally {
  socket?.disconnect();
  // Both names are generated above; never use existing operator volumes.
  assert.ok(env.CODERANK_REDIS_VOLUME.startsWith(project) && env.CODERANK_POSTGRES_VOLUME.startsWith(project));
  compose(['down', '--volumes', '--remove-orphans']);
}
