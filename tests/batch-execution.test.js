import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, chmod, rm } from 'node:fs/promises';
import path from 'node:path';
import { Executor } from '../apps/worker/src/execution/runners/Executor.js';

test('batch protocol: output framing, errors, per-case timeout and continued execution', async () => {
  const dir = await mkdtemp(path.join(process.cwd(), 'coderank-batch-'));
  const oldPath = process.env.PATH;
  try {
    await mkdir(path.join(dir, 'bin'));
    const shim = path.join(dir, 'bin/docker');
    // Run the generated shell locally for trusted test code; no Docker daemon required.
    await writeFile(path.join(dir, 'bin/metric-time'), '#!/bin/sh\nshift 2\n"$@"\nrc=$?\necho "__CODERANK_RESOURCE__:0.01:0.01:1024" >&2\nexit "$rc"\n');
    await chmod(path.join(dir, 'bin/metric-time'), 0o755);
    await writeFile(shim, `#!/bin/sh
shift 2
printf '%s' "$3" | sed 's|/usr/bin/time|metric-time|g' | bash
`);
    await chmod(shim, 0o755);
    process.env.PATH = `${dir}/bin:${oldPath}`;
    await writeFile(path.join(dir, 'solution.py'), `import sys,time\ns=sys.stdin.read()\nif s=='timeout': time.sleep(2)\nif s=='error': sys.exit(1)\nprint(s, end='')\n`);
    const executor = new Executor('python', '');
    executor.workdir = dir;
    const results = await executor.runBatch([
      { input: 'a\tb\nc', expected: 'a\tb\nc', marks: 2 },
      { input: 'error', expected: '' },
      { input: 'timeout', expected: '', time_limit: 0.05 },
      { input: '', expected: '', marks: 1 },
    ]);
    assert.deepEqual(results.map(r => r.passed), [true, false, false, true]);
    assert.equal(results[0].marksAwarded, 2);
    assert.equal(results[2].errorMessage, 'Time Limit Exceeded');
    assert.ok(results[0].runtimeMs > 0);
    assert.ok(results[0].memoryBytes > 0);
  } finally {
    process.env.PATH = oldPath;
    await rm(dir, { recursive: true, force: true });
  }
});
