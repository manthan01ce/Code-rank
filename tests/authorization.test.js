import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkJobOwnership } from '../apps/web/src/lib/queue/jobQueue.js';

test('Stage 1 Authorization: checkJobOwnership', async (t) => {
  await t.test('Submitter student owns their own job', () => {
    const jobData = { userId: 42, anonSessionId: null };
    const studentUser = { id: 42, role: 'student' };
    assert.equal(checkJobOwnership(jobData, studentUser), true);
  });

  await t.test('Different student cannot access another student\'s job', () => {
    const jobData = { userId: 42, anonSessionId: null };
    const otherStudent = { id: 99, role: 'student' };
    assert.equal(checkJobOwnership(jobData, otherStudent), false);
  });

  await t.test('Faculty can access any student\'s job', () => {
    const jobData = { userId: 42, anonSessionId: null };
    const facultyUser = { id: 5, role: 'faculty' };
    assert.equal(checkJobOwnership(jobData, facultyUser), true);
  });

  await t.test('Admin can access any student\'s job', () => {
    const jobData = { userId: 42, anonSessionId: null };
    const adminUser = { id: 1, role: 'admin' };
    assert.equal(checkJobOwnership(jobData, adminUser), true);
  });

  await t.test('Anonymous caller with valid matching session cookie owns the job', () => {
    const jobData = { userId: null, anonSessionId: 'sess-abc-123' };
    assert.equal(checkJobOwnership(jobData, null, 'sess-abc-123'), true);
  });

  await t.test('Anonymous caller with missing or wrong session cookie is denied', () => {
    const jobData = { userId: null, anonSessionId: 'sess-abc-123' };
    assert.equal(checkJobOwnership(jobData, null, 'wrong-session'), false);
    assert.equal(checkJobOwnership(jobData, null, null), false);
  });
});
