import test from 'node:test';
import assert from 'node:assert/strict';
import { guestActor, canReadJob, publicResult, assertPracticalPolicy, validateExecution } from '../packages/core/src/security/execution.js';

test('guest sessions are opaque, reusable, and reject malformed cookies', () => {
  const actor = guestActor('', true);
  assert.equal(actor.cookie.length, 64);
  assert.deepEqual(guestActor(`coderank_execution_session=${actor.cookie}`), actor);
  assert.equal(guestActor('coderank_execution_session=guess'), null);
  assert.notEqual(guestActor('', true).id, actor.id);
});
test('job ownership denies anonymous and other-user reads, including legacy ownerless jobs', () => {
  const job = { data: { userId: 5 } };
  assert.equal(canReadJob(job, null), false);
  assert.equal(canReadJob(job, { id: 6, role: 'student' }), false);
  assert.equal(canReadJob(job, { id: '5', role: 'student' }), true);
  assert.equal(canReadJob(job, { id: 1, role: 'admin' }), true);
  assert.equal(canReadJob({ data: { userId: null } }, guestActor('', true)), false);
});
test('hidden test allowlist removes inputs, expected results, outputs and future secret fields', () => {
  const result = publicResult({ cases: [{ hidden: true, passed: false, input: 'secret', expected: 'answer', actual_output: 'output', futureSecret: 'secret' }, { input: 'sample' }] });
  assert.deepEqual(result.cases, [{ hidden: true, passed: false }, { input: 'sample' }]);
});
test('all practical entry points can share batch, semester, session and role policy', () => {
  const user = { id: 5, role: 'student', session_token: 'current' };
  const practical = { status: 'active', batch_id: 'All', semester: 3 };
  const profile = { status: 'active', session_token: 'current', extra_info: { batch: 'A', semester: '3' } };
  assert.doesNotThrow(() => assertPracticalPolicy(user, practical, profile, { submit: true }));
  for (const denied of [null, { role: 'guest' }, { role: 'faculty' }]) assert.throws(() => assertPracticalPolicy(denied, practical, profile, { submit: true }));
  assert.throws(() => assertPracticalPolicy(user, { ...practical, batch_id: 'B' }, profile));
  assert.throws(() => assertPracticalPolicy(user, practical, { ...profile, session_token: 'revoked' }));
  assert.throws(() => assertPracticalPolicy(user, { ...practical, start_time: '2099-01-01' }, profile));
  assert.doesNotThrow(() => assertPracticalPolicy({ role: 'faculty' }, practical, null, { assignedFaculty: true }));
});
test('execution rejects oversized, invalid language and non-string input payloads', () => {
  assert.doesNotThrow(() => validateExecution({ language: 'python', code: 'print(1)' }));
  for (const payload of [{ language: 'go', code: 'x' }, { language: 'c', code: 'x'.repeat(131073) }, { language: 'java', code: 'x', input: {} }]) assert.throws(() => validateExecution(payload));
});
