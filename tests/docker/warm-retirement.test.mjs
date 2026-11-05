import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Sandbox } from '@coderank/runner/sandbox';
import { dockerCommand } from '@coderank/runner/docker';

// Native Docker is mandatory. These tests fail, never skip, when it is absent.
test('real Docker rejects the retired overlay and runner refuses legacy warm admission', async () => {
  await dockerCommand(['info', '--format', '{{.ServerVersion}}']);
  const overlay = fileURLToPath(new URL('../../infrastructure/compose.warm-daemons.yaml', import.meta.url));
  await assert.rejects(dockerCommand(['compose', '-f', overlay, 'config', '--quiet']), error => /no such file|does not exist|cannot find/i.test(error.stderr || error.message));
  const prior = process.env.USE_WARM_DAEMONS;
  try {
    process.env.USE_WARM_DAEMONS = 'true';
    for (const language of ['python', 'c', 'cpp', 'java', 'javascript']) {
      assert.throws(() => new Sandbox(undefined, { language }), error => error.code === 'WARM_DAEMONS_RETIRED');
    }
  } finally {
    if (prior === undefined) delete process.env.USE_WARM_DAEMONS; else process.env.USE_WARM_DAEMONS = prior;
  }
});

test('concurrent cold jobs share neither workspace, output nor detached processes', async () => {
  const a = new Sandbox(undefined, { language: 'python' });
  const b = new Sandbox(undefined, { language: 'python' });
  const marker = `retired-warm-${randomUUID()}`;
  try {
    assert.equal(a.isWarm, false); assert.equal(b.isWarm, false); assert.notEqual(a.name, b.name);
    await a.script(`set -e\necho synthetic-secret >/app/owner-file\nexec -a '${marker}' python3 -c "import time; time.sleep(20)" >/dev/null 2>&1 &`, 1000);
    assert.equal((await a.script('cat /app/owner-file', 1000)).stdout.trim(), 'synthetic-secret');
    assert.ok((await a.script('ps -o args', 1000)).stdout.includes(marker));
    assert.ok(!(await b.script('ps -o args', 1000)).stdout.includes(marker));
    const [left, right] = await Promise.all([
      a.script('sleep 0.2 && printf owner', 2000),
      b.script('test ! -e /app/owner-file && printf other', 2000),
    ]);
    assert.equal(left.stdout, 'owner'); assert.equal(right.stdout, 'other');
    await a.destroy();
    await assert.rejects(dockerCommand(['inspect', a.name]));
    const next = await b.script('test ! -e /app/owner-file && printf clean', 1000);
    assert.ok(!(await b.script('ps -o args', 1000)).stdout.includes(marker));
    assert.equal(next.stdout, 'clean');
  } finally { await Promise.all([a.destroy(), b.destroy()]); }
});

test('real output overflow removes the whole bounded cold container', async () => {
  const sandbox = new Sandbox();
  try {
    await assert.rejects(sandbox.script('yes bounded-output', 2000), error => error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER');
    assert.equal(sandbox.destroyed, true);
    await assert.rejects(dockerCommand(['inspect', sandbox.name]));
  } finally { await sandbox.destroy(); }
});
