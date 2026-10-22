import test from 'node:test';
import assert from 'node:assert/strict';
import { attachRealtime } from '../apps/web/src/lib/realtime.js';
import { createServiceToken, verifyServiceToken } from '../packages/core/src/security/service-token.js';

function fixture(service = false) {
  const handlers = new Map(), joined = [], sent = [];
  const socket = { data: { actor: { id: 5, role: 'student' }, service }, on: (name, fn) => handlers.set(name, fn), join: room => joined.push(room), leave() {} };
  const io = { to: room => ({ emit: (event, value) => sent.push({ room, event, value }) }) };
  attachRealtime(io, socket, { authorizePractical: async (_, id) => { if (id !== 7) throw Error(); }, authorizeCourse: async () => { throw Error(); }, getJobStatus: async (id, actor) => { if (id !== 'owned' || actor.id !== 5) throw Error(); return {}; } });
  return { handlers, joined, sent };
}
test('browser cannot forge job completion or faculty broadcasts', async () => {
  const f = fixture();
  let reply;
  await f.handlers.get('worker_job_complete')({ jobId: 'owned', result: { status: 'accepted' } }, value => { reply = value; });
  assert.equal(reply.ok, false);
  await f.handlers.get('faculty_practical_added')({ course_id: 7, practical: {} });
  assert.deepEqual(f.sent, []);
  assert.equal(f.handlers.has('student_new_submission'), false);
});
test('unauthorized subscriptions fail and authorized subscriptions join only their rooms', async () => {
  const f = fixture();
  await f.handlers.get('join_practical_room')(8);
  await f.handlers.get('join_course_room')(7);
  await f.handlers.get('watch_job')('someone-else');
  assert.deepEqual(f.joined, []);
  await f.handlers.get('join_practical_room')(7);
  await f.handlers.get('watch_job')('owned');
  assert.deepEqual(f.joined, ['practical_7', 'job_owned']);
});
test('trusted completion is scoped and redacted', async () => {
  const f = fixture(true);
  await f.handlers.get('worker_job_complete')({ jobId: 'owned', result: { cases: [{ hidden: true, input: 'secret', expected: 'secret', passed: true }] } });
  assert.deepEqual(f.sent, [{ room: 'job_owned', event: 'job_complete', value: { cases: [{ hidden: true, passed: true }], jobId: 'owned' } }]);
});
test('service tokens are scoped and reject tampering', () => {
  process.env.JWT_SECRET = 'test-secret-only';
  const token = createServiceToken();
  assert.equal(verifyServiceToken(token).role, 'service');
  assert.equal(verifyServiceToken(`${token}invalid`), null);
});

test('service credentials cannot be reused as browser/user JWTs', async () => {
  const { verifyToken } = await import('../packages/core/src/utils/auth.js');
  assert.equal(verifyToken(createServiceToken()), null);
});
