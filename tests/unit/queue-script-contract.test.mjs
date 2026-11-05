// CR-ARCH-08B: isolated BullMQ internal addStandardJob shape and exact version alignment.
// Redis atomicity scenarios are unconditional in tests/integration/queue-script-admission.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { addStandardJob } from '../../packages/queue/src/bullmq-scripts.js';
import { admissionBackend } from '../../packages/queue/src/index.js';

// ── Section 1: script shape (no Redis required) ──────────────────────────────

test('bullmq-scripts wrapper exports a valid addStandardJob object', () => {
  assert.ok(
    addStandardJob !== null && typeof addStandardJob === 'object',
    'addStandardJob must be a non-null object',
  );
  assert.equal(
    addStandardJob.name, 'addStandardJob',
    'addStandardJob.name must equal "addStandardJob"',
  );
  assert.equal(
    addStandardJob.keys, 9,
    'addStandardJob.keys must equal 9 (numberOfKeys used by coderankAdmitV1)',
  );
  assert.equal(
    typeof addStandardJob.content, 'string',
    'addStandardJob.content must be a string',
  );
  assert.ok(
    addStandardJob.content.length > 100,
    'addStandardJob.content must be a non-trivial Lua script',
  );
  assert.ok(
    addStandardJob.content.includes('return jobId'),
    'addStandardJob.content must contain "return jobId" (BullMQ standard insertion contract)',
  );
});

test('bullmq-scripts does not re-export the internal import through the queue public index', async () => {
  const queueModule = await import('../../packages/queue/src/index.js');
  assert.ok(
    !Object.hasOwn(queueModule, 'addStandardJob'),
    'addStandardJob must not be re-exported from the queue package public index',
  );
  const scriptsModule = await import('../../packages/queue/src/bullmq-scripts.js');
  assert.ok(
    Object.hasOwn(scriptsModule, 'addStandardJob'),
    'addStandardJob must be exported from bullmq-scripts.js (single isolation point)',
  );
});

test('admissionBackend is exported and creates a backend factory function', () => {
  const factory = admissionBackend(10, 3);
  assert.equal(typeof factory, 'function',
    'admissionBackend(maxPending, maxPerOwner) must return a function');
});

test('admissionBackend rejects invalid capacity arguments', () => {
  for (const bad of [0, -1, 1.5, NaN, Infinity, '5', null]) {
    assert.throws(
      () => admissionBackend(bad, 3),
      /Invalid queue capacity/,
      `maxPending=${String(bad)} should be rejected`,
    );
    assert.throws(
      () => admissionBackend(10, bad),
      /Invalid queue capacity/,
      `maxPerOwner=${String(bad)} should be rejected`,
    );
  }
});

test('direct BullMQ consumers and installed script package use exactly the same pinned version', async () => {
  const { readFile } = await import('node:fs/promises');
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const lock = JSON.parse(await readFile(new URL('../../package-lock.json', import.meta.url)));
  const installed = require('bullmq/package.json').version;
  for (const owner of ['apps/worker', 'packages/core', 'packages/queue']) {
    const manifest = JSON.parse(await readFile(new URL(`../../${owner}/package.json`, import.meta.url)));
    assert.match(manifest.dependencies.bullmq, /^\d+\.\d+\.\d+$/);
    assert.equal(manifest.dependencies.bullmq, '6.3.10');
    assert.equal(manifest.dependencies.bullmq, installed, owner);
    assert.equal(lock.packages[owner].dependencies.bullmq, installed, owner);
  }
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (path.endsWith('node_modules/bullmq')) assert.equal(entry.version, installed, path);
  }
});
