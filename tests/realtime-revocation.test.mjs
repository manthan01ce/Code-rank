import test from 'node:test';
import assert from 'node:assert/strict';
import { attachRealtime } from '../apps/web/src/lib/realtime.js';

function fixture(dependencies, service = false) {
  const handlers = new Map(), joined = [], sent = [];
  let disconnected = false;
  const socket = {
    data: { actor: { id: 7, role: 'faculty' }, service },
    on: (event, handler) => handlers.set(event, handler),
    join: room => joined.push(room), leave() {}, disconnect: () => { disconnected = true; },
  };
  const io = { to: room => ({ emit: (...args) => sent.push([room, ...args]) }) };
  attachRealtime(io, socket, { authorizePractical: async () => {}, authorizeCourse: async () => {}, getJobStatus: async () => ({}), ...dependencies });
  return { handlers, joined, sent, disconnected: () => disconnected };
}

test('socket subscriptions recheck current identity and disconnect revoked sessions', async () => {
  let active = true, checks = 0;
  const f = fixture({ refreshActor: async () => {
    checks++;
    if (!active) throw { status: 401 };
    return { id: 7, role: 'faculty' };
  } });
  await f.handlers.get('join_course_room')(9);
  active = false;
  let reply;
  await f.handlers.get('watch_job')('job', value => { reply = value; });
  assert.equal(checks, 2);
  assert.deepEqual(f.joined, ['course_9']);
  assert.equal(reply.ok, false);
  assert.equal(f.disconnected(), true);
});

test('expired service sessions cannot publish and service credentials cannot subscribe', async () => {
  let valid = true;
  const f = fixture({ validateService: async () => valid }, true);
  await f.handlers.get('join_course_room')(9);
  await f.handlers.get('watch_job')('job');
  assert.deepEqual(f.joined, []);
  await f.handlers.get('worker_job_complete')({ jobId: 'job', result: { status: 'accepted' } });
  assert.equal(f.sent.length, 1);
  valid = false;
  let reply;
  await f.handlers.get('worker_job_complete')({ jobId: 'job', result: {} }, value => { reply = value; });
  assert.equal(reply.ok, false);
  assert.equal(f.sent.length, 1);
});

test('subscriptions authorize the freshly loaded actor rather than the handshake snapshot', async () => {
  let received;
  const f = fixture({ refreshActor: async () => ({ id: 8, role: 'student' }), getJobStatus: async (_job, actor) => { received = actor; return {}; } });
  await f.handlers.get('watch_job')('job');
  assert.deepEqual(received, { id: 8, role: 'student' });
});
