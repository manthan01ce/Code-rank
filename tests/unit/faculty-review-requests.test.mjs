import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestScope, requestPage } from '../../apps/web/src/lib/http-client.js';
import { fetchSubmissionPage, deleteSubmission } from '../../apps/web/src/features/submissions/api/submissions-api.js';
import { fetchMarksPage, fetchGradePage } from '../../apps/web/src/features/reports/api/reports-api.js';

test('selection changes abort work and discard late successful/failed responses', async () => {
  const scope = createRequestScope();
  let release;
  const old = scope.begin();
  let state = 'initial';
  const delayed = new Promise(resolve => { release = resolve; }).then(value => {
    if (old.isCurrent()) state = value;
  });
  scope.cancel(); // deselect course or unmount, with no replacement request
  assert.equal(old.signal.aborted, true);
  release('stale course');
  await delayed;
  assert.equal(state, 'initial');
  const next = scope.begin();
  const latest = scope.begin();
  assert.equal(next.signal.aborted, true);
  assert.equal(next.isCurrent(), false);
  assert.equal(latest.isCurrent(), true);
  scope.cancel();
  assert.equal(latest.isCurrent(), false);
});

test('public review clients retain cursor/filter contracts and propagate forbidden/reset failures', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url: new URL(url, 'http://fixture'), options });
    return new Response(JSON.stringify([{ id: 1 }]), { headers: { 'X-Next-Cursor': 'next/+' } });
  });
  const scope = createRequestScope().begin();
  const page = await fetchSubmissionPage(12, 'synthetic', {
    studentSearch: 'A & B', status: 'late', sortBy: 'marks', sortOrder: 'ASC', division: 'D & E', cursor: 'cursor/+',
  }, scope.signal);
  assert.equal(page.nextCursor, 'next/+');
  assert.equal(calls[0].url.pathname, '/api/faculty/practicals/12/submissions');
  assert.deepEqual(Object.fromEntries(calls[0].url.searchParams), {
    studentSearch: 'A & B', status: 'late', sortBy: 'marks', sortOrder: 'ASC', division: 'D & E', cursor: 'cursor/+',
  });
  assert.equal(calls[0].options.signal, scope.signal);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer synthetic');
  await fetchMarksPage(7, 'synthetic', { studentCursor: 's+', practicalCursor: 'p/', department: 'CE' }, scope.signal);
  assert.deepEqual(Object.fromEntries(calls[1].url.searchParams), { studentCursor: 's+', practicalCursor: 'p/', department: 'CE' });
  await fetchGradePage(12, 'synthetic', 'next', scope.signal);
  assert.equal(calls[2].url.searchParams.get('limit'), '50');
  await deleteSubmission(5, 'synthetic');
  assert.equal(calls[3].options.method, 'DELETE');
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }));
  await assert.rejects(deleteSubmission(5, 'synthetic'), /Forbidden/);
  await assert.rejects(requestPage('/api/fixture', 'synthetic'), /Forbidden/);
});
