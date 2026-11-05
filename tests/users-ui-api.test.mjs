import test from 'node:test';
import assert from 'node:assert/strict';
import { userRequest, userListRequest, uploadUsers, createUserListLifecycle } from '../apps/web/src/features/users/api/users-api.js';

test('role-specific user clients retain CRUD, cursor, upload and error contracts', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => { calls.push({ url, options }); return new Response('{"error":"Duplicate user"}', { status: 409 }); });
  const options = { method: 'PUT', headers: { Authorization: 'Bearer synthetic' }, body: '{"role":"faculty"}' };
  const result = await userRequest(7, options);
  assert.equal(result.status, 409); assert.equal((await result.json()).error, 'Duplicate user');
  await userRequest(null, { ...options, method: 'POST' });
  await userRequest(7, { ...options, method: 'DELETE' });
  await userListRequest('/api/users?role=student&cursor=25&division=CE1', options);
  const csv = new File(['name,email\nFixture,f@example.test'], 'users.csv', { type: 'text/csv' });
  for (const role of ['faculty', 'student']) await uploadUsers(csv, role, 'synthetic');
  assert.deepEqual(calls.map(c => c.url), ['/api/users/7', '/api/users', '/api/users/7', '/api/users?role=student&cursor=25&division=CE1', '/api/users/bulk', '/api/users/bulk']);
  assert.deepEqual(calls.slice(0, 3).map(c => c.options.method), ['PUT', 'POST', 'DELETE']);
  for (const [index, role] of [[4, 'faculty'], [5, 'student']]) {
    assert.equal(calls[index].options.body.get('role'), role);
    assert.equal(await calls[index].options.body.get('file').text(), await csv.text());
    assert.equal(calls[index].options.headers.Authorization, 'Bearer synthetic');
  }
});

test('list cleanup aborts requests and invalidates a late response after unmount', async () => {
  const lifecycle = createUserListLifecycle();
  const controller = new AbortController();
  lifecycle.activeAbortController.current = controller;
  const version = ++lifecycle.requestVersion.current;
  let release;
  let rows = ['current'];
  const pending = new Promise(resolve => { release = resolve; }).then(data => {
    if (version === lifecycle.requestVersion.current) rows = data;
  });
  lifecycle.cancel();
  release(['late']); await pending;
  assert.equal(controller.signal.aborted, true);
  assert.deepEqual(rows, ['current']);
});
