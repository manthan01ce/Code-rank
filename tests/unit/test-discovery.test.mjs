import test from 'node:test';
import assert from 'node:assert/strict';
import { filesFor, discoverLanes, validateTestInventory } from '../../scripts/ci/test-lanes.mjs';
import { verifyTap } from '../../scripts/ci/verify-tap.mjs';

test('bidirectional inventory rejects missing, orphan, duplicate and empty lane sets', async () => {
  const categories = await discoverLanes();
  const manifest = { categories, quarantine: Object.fromEntries(categories.quarantine.map(f => [f, 'pending real Docker'])) };
  const files = Object.values(categories).flat();
  assert.equal(validateTestInventory(files, manifest), categories);
  assert.throws(() => validateTestInventory([], manifest), /Empty/);
  assert.throws(() => validateTestInventory(files.slice(1), manifest), /Missing/);
  assert.throws(() => validateTestInventory([...files, 'tests/unit/orphan.test.mjs'], manifest), /Unassigned/);
  assert.throws(() => validateTestInventory(files, { ...manifest, categories: { ...categories, docker: [...categories.docker, categories.unit[0]] } }), /Duplicate/);
  assert.throws(() => validateTestInventory(files, { ...manifest, categories: { ...categories, integration: [] } }), /Empty/);
  assert.throws(() => validateTestInventory(files, { ...manifest, quarantine: {} }), /Quarantine/);
  assert.throws(() => validateTestInventory(files, { ...manifest, categories: { ...categories, unowned: [] } }), /Unknown/);
  assert.throws(() => validateTestInventory(files, { ...manifest, quarantine: { [categories.quarantine[0]]: '' } }), /reason/);
  assert.ok((await filesFor('unit')).includes('tests/unit/job-lifecycle.test.js'));
  assert.ok((await filesFor('unit')).includes('tests/unit/queue-script-contract.test.mjs'));
  assert.ok((await filesFor('integration')).includes('tests/integration/queue.test.mjs'));
  assert.throws(() => validateTestInventory([...files, files[0]], manifest), /Duplicate/);
  assert.ok(!(await filesFor('docker')).includes('tests/docker/batch-execution.test.js'));
});

test('missing, duplicate and empty executed-file evidence cannot certify a TAP stream', () => {
  for (const executedFiles of [[], ['a.test.mjs'], ['a.test.mjs', 'a.test.mjs']]) {
    const result = verifyTap('', { expectedFiles: ['a.test.mjs', 'b.test.mjs'], executedFiles });
    assert.ok(result.errors.some(e => e.includes('Executed file evidence')));
  }
});
