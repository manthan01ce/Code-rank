import test from 'node:test';
import assert from 'node:assert/strict';
import { facultyReviewResponse } from '../browser/fixtures/faculty-review.mjs';
import { fetchCollection } from '../../apps/web/src/lib/fetch-collection.js';
import { fetchCoursePracticals } from '../../apps/web/src/features/practicals/api/practicals-api.js';
import { fetchSubmissionPage } from '../../apps/web/src/features/submissions/api/submissions-api.js';

test('browser fixtures load finite selectors through the real collection client and page submissions', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async url => {
    const parsed = new URL(url, 'http://fixture');
    calls.push(parsed);
    const { json, headers } = facultyReviewResponse(parsed);
    return new Response(JSON.stringify(json), { headers });
  });
  const courses = await fetchCollection('/api/faculty/courses');
  assert.deepEqual(courses.map(c => c.id), [1, 2]);
  assert.deepEqual(await fetchCollection('/api/faculty/batches'), ['2024']);
  assert.equal((await fetchCoursePracticals(1, 'synthetic'))[0].id, 1);
  assert.equal((await fetchCoursePracticals(2, 'synthetic'))[0].id, 2);
  assert.equal(calls.length, 4, 'complete selectors must each require exactly one request');
  assert.ok(calls.every(url => !url.searchParams.has('cursor')));
  const page = await fetchSubmissionPage(1, 'synthetic', {
    studentSearch: '', status: 'in-time', sortBy: 'submission_time', sortOrder: 'DESC', division: 'all',
  });
  assert.equal(page.data[0].student_name, 'First Student');
  assert.equal(page.nextCursor, 'next-page', 'submission table must retain its paging coverage');
});
