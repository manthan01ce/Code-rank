import test from 'node:test';
import assert from 'node:assert/strict';
import { Executor } from '../apps/worker/src/execution/runners/Executor.js';

test('identical code gets private workspaces and compilation never trusts directory existence', async () => {
  const calls = [];
  const runDocker = async (args, options) => { calls.push({ args, options }); return { stdout: '', stderr: '' }; };
  const a = new Executor('cpp', 'source', 3000, null, { runDocker });
  const b = new Executor('cpp', 'source', 3000, null, { runDocker });
  assert.notEqual(a.workdir, b.workdir);
  assert.equal((await a.compile()).cached, false);
  assert.match(calls.find(c => c.args[0] === 'exec').options.input, /g\+\+/);
  assert.equal(calls.find(c => c.args[0] === 'exec').args.includes('timeout'), true);
});
test('runtime failure never passes even when output matches; timings are measured', async () => {
  const runDocker = async args => { if (args[0] !== 'exec') return {}; throw Object.assign(new Error('failed'), { code: 1, stdout: 'expected', stderr: 'runtime error' }); };
  const runner = new Executor('python', 'code', 3000, null, { runDocker });
  const [result] = await runner.runBatch([{ id: 1, input: '', expected: 'expected', marks: 10 }]);
  assert.equal(result.passed, false);
  assert.equal(result.marksAwarded, 0);
  assert.ok(result.runtimeMs > 0);
});
test('per-case deadlines run inside the container and timeout cannot pass an empty-output test', async () => {
  let observed;
  const runDocker = async (args, options) => { if (args[0] !== 'exec') return {}; observed = { args, options }; throw Object.assign(new Error('timeout'), { code: 124 }); };
  const runner = new Executor('python', 'code', 3000, null, { runDocker });
  const [result] = await runner.runBatch([{ input: '', expected: '', time_limit: 0.05 }]);
  assert.ok(observed.args.includes('0.050s'));
  assert.equal(result.passed, false);
  assert.equal(result.errorMessage, 'Time Limit Exceeded');
});
test('successful output with diagnostic stderr remains a successful process', async () => {
  const runner = new Executor('python', 'code', 3000, null, { runDocker: async () => ({ stdout: 'ok\n', stderr: 'warning\n__CODERANK_RESOURCE__:0.01:0.02:20' }) });
  const result = await runner.runOneTestCase('', 'ok', 1, 0, 2);
  assert.equal(result.passed, true);
  assert.equal(result.cpuTimeMs, 30);
  assert.equal(result.memoryBytes, 20480);
});
test('function-style practice cases are rejected instead of silently misgraded as stdin/stdout', async () => {
  const runner = new Executor('c', 'code');
  await assert.rejects(runner.runBatch([{ args: [1], expected: 2 }]), /stdin\/stdout/);
});
test('playground cleanup runs after failures', async () => {
  const calls = [];
  const runner = new Executor('python', 'code', 3000, null, { runDocker: async args => { calls.push(args); throw new Error('offline'); } });
  await assert.rejects(runner.runPlayground(''), /offline/);
  assert.deepEqual(calls.at(-1).slice(0, 2), ['rm', '-f']);
});

test('execution cannot exceed five seconds through defaults, constructor or testcase overrides', async () => {
  const { executionBudget } = await import('../packages/runner/src/Executor.js');
  for (const value of [undefined, 0, -1, Infinity, NaN, 999999]) assert.equal(executionBudget(value), 5000);
  assert.equal(executionBudget(40), 40);
  const calls = [];
  const runner = new Executor('python', 'while True: pass', 60000, null, {
    runDocker: async (args, options) => { calls.push({ args, options }); return { stdout: '', stderr: '' }; },
  });
  assert.equal(runner.timeLimit, 5000);
  await runner.runOneTestCase('', '', 'direct', 0, 0, 60000);
  await runner.runBatch([{ input: '', expected: '', time_limit: 90 }]);
  const executions = calls.filter(call => call.args[0] === 'exec');
  assert.equal(executions.length, 2);
  for (const call of executions) {
    const budget = call.args.find(value => /^\d+\.\d+s$/.test(value));
    assert.ok(parseFloat(budget) <= 5, budget);
    assert.ok(call.options.timeout <= 7000);
  }
  await runner.cleanup();
});
