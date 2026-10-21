import test from 'node:test';
import assert from 'node:assert/strict';
import { guardRealtimeSession } from '../apps/web/src/lib/realtime-session.js';

function fixture(options = {}) {
  const timers = [], handlers = new Map();
  let disconnects = 0;
  const socket = { on: (event, callback) => handlers.set(event, callback), disconnect: () => { disconnects++; handlers.get('disconnect')?.(); } };
  guardRealtimeSession(socket, {
    now: () => 100,
    setTimer: (callback, delay) => {
      const timer = { callback, delay, unrefed: false, cleared: false, unref() { this.unrefed = true; } };
      timers.push(timer);
      return timer;
    },
    clearTimer: timer => { timer.cleared = true; },
    ...options,
  });
  return { timers, handlers, disconnects: () => disconnects };
}

test('idle revoked browser disconnects and clears its session timers', async () => {
  const f = fixture({ expiresAt: 10000, revalidate: async () => { throw new Error('revoked'); } });
  assert.equal(f.timers[1].delay, 30000);
  await f.timers[1].callback();
  assert.equal(f.disconnects(), 1);
  assert.ok(f.timers.every(timer => timer.cleared && timer.unrefed));
});

test('service and guest sockets expire without database revalidation timers', async () => {
  const f = fixture({ expiresAt: 10100 });
  assert.equal(f.timers.length, 1);
  assert.equal(f.timers[0].delay, 10000);
  f.timers[0].callback();
  assert.equal(f.disconnects(), 1);
});

test('periodic checks never overlap or resurrect a disconnected socket', async () => {
  let release, checks = 0;
  const f = fixture({ revalidate: () => { checks++; return new Promise(resolve => { release = resolve; }); } });
  const pending = f.timers[0].callback();
  assert.equal(checks, 1);
  assert.equal(f.timers.length, 1);
  f.handlers.get('disconnect')();
  release();
  await pending;
  assert.equal(f.timers.length, 1);
  assert.equal(f.timers[0].cleared, true);
});

test('valid idle sessions schedule only the next bounded unrefed check', async () => {
  const f = fixture({ revalidate: async () => {} });
  await f.timers[0].callback();
  assert.equal(f.timers.length, 2);
  assert.equal(f.timers[1].delay, 30000);
  assert.equal(f.timers[1].unrefed, true);
});
