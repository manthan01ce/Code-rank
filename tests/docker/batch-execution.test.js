import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { Executor } from '@coderank/runner';
import { dockerCommand } from '@coderank/runner/docker';

// CR-ARCH-24: real Executor/Sandbox coverage, no host Docker-command shim.
// Still explicitly quarantined until these scenarios pass against real Docker.
const source = `import sys,time
s=sys.stdin.read()
if s=='timeout': time.sleep(10)
if s=='error': sys.exit(3)
print(s,end='')
`;
function disposableExecutor(language, code) {
  // The forwarding adapter uses real Docker. Cold-only policy is enforced by
  // Sandbox; stale enabled warm configuration now fails explicitly.
  const executor = new Executor(language, code, 5000, null, { runDocker: (args, options) => dockerCommand(args, options) });
  assert.equal(executor.sandbox.isWarm, false);
  assert.match(executor.sandbox.name, /^coderank-job-/);
  return executor;
}
async function cleaned(executor) {
  await executor.cleanup();
  assert.equal(executor.sandbox.destroyed, true);
  const remaining = await dockerCommand(['ps', '-aq', '--filter', `name=^/${executor.sandbox.name}$`]);
  assert.equal(remaining.stdout.trim(), '', 'test-owned container must be absent from the real daemon');
}

test('real batch framing/marks survives an ordinary case error and continues', async () => {
  const executor = disposableExecutor('python', source);
  const started = performance.now();
  try {
    const compile = await executor.compile();
    assert.equal(compile.success, true, compile.error);
    const results = await executor.runBatch([
      { input: 'a\tb\nc', expected: 'a\tb\nc', marks: 2 },
      { input: 'error', expected: '' },
      { input: '', expected: '', marks: 1 },
    ]);
    assert.deepEqual(results.map(r => r.passed), [true, false, true]);
    assert.equal(results[0].marksAwarded, 2);
    assert.equal(results[1].exitCode, 3);
    assert.equal(results[2].marksAwarded, 1);
    assert.ok(results[0].runtimeMs > 0);
    assert.ok(results[0].memoryBytes > 0);
    assert.ok(performance.now() - started < executor.sandbox.lifetime + 2000);
  } finally { await cleaned(executor); }
});

test('real batch timeout destroys its sandbox and later cases fail closed', async () => {
  const executor = disposableExecutor('python', source);
  const started = performance.now();
  try {
    assert.equal((await executor.compile()).success, true);
    const results = await executor.runBatch([
      { input: 'timeout', expected: '', time_limit: 0.05 },
      { input: 'must-not-execute', expected: 'must-not-execute' },
    ]);
    assert.deepEqual(results.map(r => r.passed), [false, false]);
    assert.equal(results[0].exitCode, 124);
    assert.equal(results[0].errorMessage, 'Time Limit Exceeded');
    assert.equal(executor.sandbox.destroyed, true);
    assert.match(results[1].errorMessage, /Sandbox is closed/);
    assert.ok(performance.now() - started < executor.sandbox.lifetime + 2000);
  } finally { await cleaned(executor); }
});

test('real compilation failure is reported and leaves no batch container', async () => {
  const executor = disposableExecutor('c', 'this is not valid C;');
  try {
    const result = await executor.compile();
    assert.equal(result.success, false);
    assert.ok(result.error.length > 0);
  } finally { await cleaned(executor); }
});

test('real compiled batch rejects malformed case fields and cleans up', async () => {
  const executor = disposableExecutor('python', source);
  try {
    assert.equal((await executor.compile()).success, true);
    await assert.rejects(executor.runBatch([{ input: 7, expected: '' }]), /require input and expected output/);
  } finally { await cleaned(executor); }
});
