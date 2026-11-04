import test from 'node:test';
import assert from 'node:assert/strict';
import { roleSession } from '../apps/web/src/features/auth/api/role-session.js';
import { selfProfileRequest, usernameProfileRequest } from '../apps/web/src/features/profile/api/profile-api.js';

test('shared role gate preserves role permissions and rejects missing/corrupt sessions', () => {
  const store = (token, user) => ({ getItem: key => key === 'token' ? token : user });
  for (const role of ['admin', 'faculty', 'student']) {
    const storage = store('bearer', JSON.stringify({ role }));
    assert.equal(roleSession(storage, 'admin').isReady, role === 'admin');
    assert.equal(roleSession(storage, 'faculty').isReady, role !== 'student');
  }
  for (const storage of [store(null, '{"role":"admin"}'), store('bearer', 'broken'), store('bearer', 'null'), { getItem() { throw Error('blocked'); } }]) {
    assert.deepEqual(roleSession(storage, 'admin'), { token: null, isReady: false });
  }
});

test('self-identity and username profile requests keep independent public contracts and abort signals', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (path, options) => { calls.push({ path, options }); return new Response('{}'); });
  const controller = new AbortController();
  const options = { headers: { Authorization: 'Bearer synthetic' }, signal: controller.signal, cache: 'no-store' };
  await selfProfileRequest(options);
  await usernameProfileRequest('a/b', options);
  await selfProfileRequest({ ...options, method: 'PUT', body: JSON.stringify({ name: 'New' }) });
  assert.deepEqual(calls.map(c => c.path), ['/api/auth/profile', '/api/profile/a%2Fb', '/api/auth/profile']);
  assert.equal(calls[2].options.method, 'PUT');
  assert.ok(calls.every(c => c.options.signal === controller.signal));
  controller.abort();
  assert.ok(calls.every(c => c.options.signal.aborted));
});
