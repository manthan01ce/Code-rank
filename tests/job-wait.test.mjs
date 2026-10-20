import test from 'node:test';
import assert from 'node:assert/strict';
import { waitForJob } from '../apps/web/src/lib/wait-for-job.js';

test('polling preserves authorization and returns completed result', async () => {
  let headers;
  const result = await waitForJob({ jobId: 'abc', token: 'token', fetchImpl: async (_, options) => { headers = options.headers; return { ok: true, json: async () => ({ status: 'completed', result: { ok: true } }) }; } });
  assert.deepEqual(result, { ok: true });
  assert.equal(headers.Authorization, 'Bearer token');
});
test('access denied stops polling immediately', async () => {
  await assert.rejects(waitForJob({ jobId: 'abc', fetchImpl: async () => ({ status: 403 }) }), /access was denied/);
});
test('a hung request is bounded and aborted by the deadline', async () => {
  let signal;
  await assert.rejects(waitForJob({ jobId: 'abc', timeoutMs: 10, fetchImpl: (_, opts) => { signal = opts.signal; return new Promise(() => {}); } }), /timed out/);
  assert.equal(signal.aborted, true);
});
test('socket completion only resolves its matching job and cleans subscriptions', async () => {
  let listener, removed = false;
  const socket = { on: (_, fn) => { listener = fn; }, off: () => { removed = true; }, emit() {} };
  const waiting = waitForJob({ jobId: 'mine', socket, fetchImpl: () => new Promise(() => {}) });
  listener({ jobId: 'other', result: 'wrong' });
  assert.equal(removed, false);
  listener({ jobId: 'mine', status: 'accepted' });
  assert.equal((await waiting).status, 'accepted');
  assert.equal(removed, true);
});
