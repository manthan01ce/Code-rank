import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  fetchCoursePracticals,
  fetchPracticalDetails,
  createPractical,
  updatePractical,
  deletePractical,
  grantExtraTime,
} from '../../apps/web/src/features/practicals/api/practicals-api.js';

test('practicals API client constructs correct URLs, methods, headers and payloads', async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return {
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => (url.includes('course_id') ? [{ id: 1, title: 'Sample' }] : { success: true, url, method: options.method || 'GET' }),
    };
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  // 1. fetchCoursePracticals
  await fetchCoursePracticals('42', 'test-token');
  assert.equal(calls[0].url, '/api/faculty/practicals?course_id=42');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-token');

  // 2. fetchPracticalDetails
  await fetchPracticalDetails('101', 'test-token');
  assert.equal(calls[1].url, '/api/faculty/practicals/101');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer test-token');

  // 3. createPractical
  const createPayload = { title: 'New Practical', course_id: 42 };
  await createPractical(createPayload, 'test-token');
  assert.equal(calls[2].url, '/api/faculty/practicals');
  assert.equal(calls[2].options.method, 'POST');
  assert.equal(calls[2].options.headers['Content-Type'], 'application/json');
  assert.equal(calls[2].options.headers.Authorization, 'Bearer test-token');
  assert.deepEqual(JSON.parse(calls[2].options.body), createPayload);

  // 4. updatePractical
  const updatePayload = { title: 'Updated Practical' };
  await updatePractical('101', updatePayload, 'test-token');
  assert.equal(calls[3].url, '/api/faculty/practicals/101');
  assert.equal(calls[3].options.method, 'PUT');
  assert.equal(calls[3].options.headers['Content-Type'], 'application/json');
  assert.equal(calls[3].options.headers.Authorization, 'Bearer test-token');
  assert.deepEqual(JSON.parse(calls[3].options.body), updatePayload);

  // 5. deletePractical
  await deletePractical('101', 'test-token');
  assert.equal(calls[4].url, '/api/faculty/practicals/101');
  assert.equal(calls[4].options.method, 'DELETE');
  assert.equal(calls[4].options.headers.Authorization, 'Bearer test-token');

  // 6. grantExtraTime
  const extraTimePayload = { extraMinutes: 30 };
  await grantExtraTime('101', extraTimePayload, 'test-token');
  assert.equal(calls[5].url, '/api/faculty/practicals/101/extra-time');
  assert.equal(calls[5].options.method, 'POST');
  assert.equal(calls[5].options.headers['Content-Type'], 'application/json');
  assert.equal(calls[5].options.headers.Authorization, 'Bearer test-token');
  assert.deepEqual(JSON.parse(calls[5].options.body), extraTimePayload);
});

test('practicals API client surfaces backend error messages on failure', async (t) => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => ({
    ok: false,
    status: 403,
    json: async () => ({ error: 'Only co-coordinators can manage practicals.' }),
  });

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  await assert.rejects(
    () => createPractical({ title: 'Denied' }, 'test-token'),
    /Only co-coordinators can manage practicals\./
  );

  await assert.rejects(
    () => updatePractical('101', { title: 'Denied' }, 'test-token'),
    /Only co-coordinators can manage practicals\./
  );

  await assert.rejects(
    () => deletePractical('101', 'test-token'),
    /Only co-coordinators can manage practicals\./
  );

  await assert.rejects(
    () => grantExtraTime('101', { extraMinutes: 10 }, 'test-token'),
    /Only co-coordinators can manage practicals\./
  );
});

test('practicals feature obeys frontend-only boundary constraints', () => {
  const practicalsDir = path.resolve(import.meta.dirname, '../../apps/web/src/features/practicals');
  const readFiles = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...readFiles(fullPath));
      } else if (/\.[cm]?[jt]sx?$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
    return files;
  };

  const featureFiles = readFiles(practicalsDir);
  assert.ok(featureFiles.length >= 5, 'Expected extracted practical feature files');

  for (const file of featureFiles) {
    const content = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(content, /@coderank\/database/, `${file} must not import database package`);
    assert.doesNotMatch(content, /@coderank\/queue/, `${file} must not import queue package`);
    assert.doesNotMatch(content, /@coderank\/runner/, `${file} must not import runner package`);
    assert.doesNotMatch(content, /@coderank\/core\/db/, `${file} must not import core database client`);
  }
});
