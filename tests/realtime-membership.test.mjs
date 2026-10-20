import test from 'node:test';
import assert from 'node:assert/strict';
import { attachRealtime, revalidateRealtimeRooms } from '../apps/web/src/lib/realtime.js';

function fixture() {
  const handlers = new Map(), joined = new Set(), left = [];
  const actor = { id: 7, role: 'faculty' };
  const socket = {
    data: { actor }, on: (event, handler) => handlers.set(event, handler),
    join: async room => { joined.add(room); },
    leave: async room => { left.push(room); joined.delete(room); },
  };
  const authorization = { actor, authorizeCourse: async () => {}, authorizePractical: async () => {}, getJobStatus: async () => ({}) };
  attachRealtime({}, socket, authorization);
  return { socket, handlers, joined, left, authorization };
}

test('periodic room checks remove revoked course and practical mappings and expired jobs', async () => {
  const f = fixture();
  await f.handlers.get('join_course_room')(2);
  await f.handlers.get('join_practical_room')(3);
  await f.handlers.get('watch_job')('expired');
  await f.handlers.get('watch_job')('valid');
  await revalidateRealtimeRooms(f.socket, {
    ...f.authorization,
    authorizeCourse: async (_actor, id) => { assert.equal(id, 2); throw new Error('Mapping revoked'); },
    authorizePractical: async (_actor, id) => { assert.equal(id, 3); throw new Error('Mapping revoked'); },
    getJobStatus: async id => id === 'valid' ? {} : null,
  });
  assert.deepEqual([...f.joined], ['job_valid']);
  assert.deepEqual([...f.socket.data.subscriptionRooms], ['job_valid']);
  assert.equal(f.left.length, 3);
});

test('concurrent subscriptions cannot exceed 64 and leaving releases capacity', async () => {
  const f = fixture();
  const responses = [];
  await Promise.all(Array.from({ length: 100 }, (_, index) => f.handlers.get('watch_job')(`job-${index}`, reply => responses.push(reply))));
  assert.equal(f.socket.data.subscriptionRooms.size, 64);
  assert.equal(responses.filter(reply => reply.ok).length, 64);
  await f.handlers.get('unwatch_job')('job-0');
  await f.handlers.get('watch_job')('replacement');
  assert.equal(f.socket.data.subscriptionRooms.size, 64);
  assert.equal(f.joined.has('job_replacement'), true);
});

test('periodic authorization errors fail closed and clear affected room membership', async () => {
  const f = fixture();
  await f.handlers.get('join_course_room')(2);
  await revalidateRealtimeRooms(f.socket, { ...f.authorization, authorizeCourse: async () => { throw new Error('Database unavailable'); } });
  assert.equal(f.joined.size, 0);
  assert.equal(f.socket.data.subscriptionRooms.size, 0);
});
