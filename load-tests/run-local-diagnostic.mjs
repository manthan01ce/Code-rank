/** Starts real local processes and captures smoke evidence; never mocks dependencies. */
import 'dotenv/config';
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

const root = process.cwd();
const output = path.resolve(root, process.env.DIAGNOSTIC_OUTPUT || 'reports/local-diagnostic');
mkdirSync(output, { recursive: true });
const environment = { ...process.env, HOSTNAME: '0.0.0.0', PORT: '3000', NEXT_TELEMETRY_DISABLED: '1',
  // Ephemeral development secrets permit startup without supplying production credentials.
  JWT_SECRET: process.env.JWT_SECRET || randomBytes(32).toString('hex'),
  WORKER_SERVICE_TOKEN: process.env.WORKER_SERVICE_TOKEN || randomBytes(32).toString('hex') };
const streams = [];
const processes = [];
function start(command, args, name, env = environment) {
  const log = createWriteStream(path.join(output, `${name}.log`));
  streams.push(log);
  const child = spawn(command, args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  processes.push(child);
  child.stdout.pipe(log); child.stderr.pipe(log);
  return child;
}
const result = { startedAt: new Date().toISOString(), baseUrl: 'http://127.0.0.1:3000',
  notes: ['Real application/worker processes; no Docker, Redis or DB mocks.', 'Development-mode smoke, not a production capacity benchmark.'] };
const web = start(process.execPath, ['apps/web/server.js'], 'web');
const worker = start(process.execPath, ['apps/worker/src/index.js'], 'worker');
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Web startup exceeded 30s')), 30000);
    web.once('error', reject);
    web.once('exit', code => { clearTimeout(timer); reject(new Error(`Web exited ${code}`)); });
    web.stdout.on('data', chunk => {
      if (chunk.toString().includes('Server ready')) { clearTimeout(timer); resolve(); }
    });
  });
  console.log('Web ready; checking dependency health.');
  const health = await fetch(`${result.baseUrl}/api/health`, { signal: AbortSignal.timeout(12000) });
  result.health = { status: health.status, body: await health.json() };
  console.log(JSON.stringify(result.health));
  // Small diagnostic workload is deliberately allowed against degraded health.
  // All higher-load tests must gate on successful dependency and smoke checks.
  const k6 = start(process.env.K6_BIN || 'k6', ['run', '--no-color',
    '--stage', '1s:1', '--stage', '5s:1', '--stage', '1s:0',
    '--summary-export', path.join(output, 'smoke-summary.json'),
    '-e', `BASE_URL=${result.baseUrl}`, 'load-tests/smoke-test.js'], 'k6-smoke');
  result.k6ExitCode = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { k6.kill('SIGTERM'); reject(new Error('Smoke exceeded 50s')); }, 50000);
    k6.once('error', error => {clearTimeout(timer); reject(error);});
    k6.once('exit', code => {clearTimeout(timer); resolve(code);});
  });
  result.capacityTests = result.health.status !== 200 || result.k6ExitCode !== 0
    ? 'BLOCKED: dependency or smoke gates failed; 200-VU workloads not started'
    : 'Ready for authenticated qualification; requires real student fixtures';
} catch (error) { result.error = error.message; }
finally {
  for (const child of processes) if (child.exitCode === null) child.kill('SIGTERM');
  // BullMQ retries can keep a worker alive without Redis. Bound diagnostic cleanup.
  await new Promise(resolve => setTimeout(resolve, 1000));
  for (const child of processes) if (child.exitCode === null) child.kill('SIGKILL');
  for (const stream of streams) stream.end();
  result.finishedAt = new Date().toISOString();
  writeFileSync(path.join(output, 'diagnostic.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, output }, null, 2));
}
process.exitCode = result.error || result.k6ExitCode !== 0 || result.health?.status !== 200 ? 1 : 0;
