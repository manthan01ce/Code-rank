import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Executor } from '../apps/worker/src/execution/runners/Executor.js';
import { runC } from '../apps/worker/src/execution/runners/c.js';
import { runJavaScript } from '../apps/worker/src/execution/runners/javascript.js';

test('Stage 3 Runner Correctness: Isolation and Function-Style Fallback', async (t) => {
  await t.test('Executor assigns private per-execution workdir (no compilation caching)', () => {
    const code = '#include <stdio.h>\nint main() { return 0; }';
    const ex1 = new Executor('c', code);
    const ex2 = new Executor('c', code);

    assert.notEqual(ex1.executionId, ex2.executionId);
    assert.notEqual(ex1.workdir, ex2.workdir);
    assert.ok(ex1.workdir.includes(ex1.executionId));
    assert.ok(ex2.workdir.includes(ex2.executionId));
  });

  await t.test('C runner returns explicit unsupported for function-style practice', async () => {
    const res = await runC({
      code: 'int add(int a, int b) { return a + b; }',
      problem: { entry: { type: 'class-method' } }
    });
    assert.equal(res.status, 'unsupported');
    assert.ok(res.summary.includes('Unsupported: C function-style practice is not yet implemented'));
  });

  await t.test('JavaScript runner returns explicit unsupported for function-style practice', async () => {
    const res = await runJavaScript({
      code: 'function add(a, b) { return a + b; }',
      problem: { entry: { type: 'class-method' } }
    });
    assert.equal(res.status, 'unsupported');
    assert.ok(res.summary.includes('Unsupported: JavaScript function-style practice is not yet implemented'));
  });
});
