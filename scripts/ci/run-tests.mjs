import { spawn } from 'node:child_process';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { verifyTap } from './verify-tap.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
export async function testConfiguration(mode) {
  const integration = ['queue', 'realtime', 'worker-readiness', 'worker-recovery', 'postgres'].map(name => `tests/integration/${name}.test.mjs`);
  const modes = {
    unit: { files: (await readdir(resolve(root, 'tests'))).filter(name => name.endsWith('.test.mjs')).sort().map(name => `tests/${name}`), timeoutMs: 300000 },
    integration: { files: integration, timeoutMs: 300000 },
    docker: { files: ['tests/integration/sandbox.test.mjs'], timeoutMs: 300000 },
  };
  if (!Object.hasOwn(modes, mode)) throw new Error('Expected exactly one mode: unit, integration, or docker');
  const config = modes[mode];
  if (!config.files.length) throw new Error('No test files discovered');
  return { ...config, args: ['--experimental-test-module-mocks', '--test-concurrency=2', '--test-timeout=30000', '--test-reporter=tap', '--test', ...config.files] };
}

export async function captureTestProcess(args, { timeoutMs, env = process.env } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 300000) throw new Error('Invalid subprocess deadline');
  let stdout = '', stderr = '', timedOut = false;
  let limitExceeded = false;
  const result = await new Promise((done, reject) => {
    // Detached group lets a hard deadline kill child test workers and their
    // compiler/runtime descendants as well as the parent test runner.
    const child = spawn(process.execPath, args, { cwd: root, env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    const kill = () => {
      try { if (process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') child.kill('SIGKILL'); }
    };
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    const interrupt = () => kill();
    process.on('SIGTERM', interrupt);
    process.on('SIGINT', interrupt);
    const cleanup = () => { clearTimeout(timer); process.off('SIGTERM', interrupt); process.off('SIGINT', interrupt); };
    const timer = setTimeout(() => { timedOut = true; kill(); }, timeoutMs);
    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
      if (stdout.length > 32 * 1024 * 1024) { limitExceeded = true; kill(); }
    });
    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
      if (stderr.length > 4 * 1024 * 1024) { limitExceeded = true; kill(); }
    });
    child.once('error', error => { cleanup(); reject(error); });
    child.once('close', (exitCode, signal) => { cleanup(); done({ exitCode, signal }); });
  });
  return { ...result, stdout, stderr, timedOut, limitExceeded };
}

export async function runTestMode(mode) {
  const config = await testConfiguration(mode);
  // Do not let externally supplied Node flags silently reduce the test set.
  const inherited = [...process.execArgv, process.env.NODE_OPTIONS || ''];
  if (inherited.some(arg => /--test-(?:only|name-pattern|skip-pattern|shard)(?:=|\s|$)/.test(arg))) throw new Error('Filtered test flags are forbidden');
  const artifact = resolve(root, 'test-results', `${mode}.tap`);
  await mkdir(resolve(root, 'test-results'), { recursive: true });
  await writeFile(artifact, '');
  const result = await captureTestProcess(config.args, { timeoutMs: config.timeoutMs });
  const { stdout, stderr, timedOut, limitExceeded } = result;
  await writeFile(artifact, stdout);
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  const verdict = verifyTap(stdout, { ...result, timedOut, args: config.args, expectedFiles: config.files });
  if (limitExceeded) { verdict.ok = false; verdict.errors.push('Test output exceeded the bounded artifact limit'); }
  if (!verdict.ok) throw new Error(`Strict ${mode} test gate failed:\n${verdict.errors.join('\n')}`);
  console.log(`Strict ${mode} test gate passed: ${verdict.counts.tests} tests; artifact test-results/${mode}.tap`);
  return verdict;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) { console.error('Usage: node scripts/ci/run-tests.mjs <unit|integration|docker>'); process.exitCode = 1; }
  else await runTestMode(process.argv[2]).catch(error => { console.error(error.message); process.exitCode = 1; });
}
