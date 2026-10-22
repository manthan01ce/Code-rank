import test from 'node:test';
import assert from 'node:assert/strict';
let mapped = false;
const practical = { id: 9, faculty_id: 7, course_id: 2, status: 'active', semester: 1 };
test.mock.module('../packages/core/src/db/client.js', { defaultExport: async strings => {
  const text = strings.join('?');
  if (text.includes('FROM course_faculty')) return mapped ? [{ assigned: 1 }] : [];
  if (text.includes('SELECT p.*')) return [practical];
  if (text.includes('FROM practical_submissions')) return [{ id: 4, student_id: 5, practical_id: 9, faculty_id: 7 }];
  if (text.includes('FROM practical_submission_cases')) return [];
  throw new Error('Unexpected query in authorization test');
} });
const { PracticalService } = await import('../packages/core/src/modules/practicals/PracticalService.js');
const { SubmissionService } = await import('../packages/core/src/modules/submissions/SubmissionService.js');
const faculty = { id: 7, role: 'faculty' };

test('original practical ownership cannot bypass a revoked current faculty mapping', async () => {
  await assert.rejects(PracticalService.authorize(faculty, 9), error => error.status === 403);
  await assert.rejects(SubmissionService.getSubmission(faculty, 4), error => error.status === 403);
  mapped = true;
  assert.equal((await PracticalService.authorize(faculty, 9)).id, 9);
  assert.equal((await SubmissionService.getSubmission(faculty, 4)).id, 4);
});
