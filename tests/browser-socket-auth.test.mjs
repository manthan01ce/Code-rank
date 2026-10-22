import test from 'node:test';
import assert from 'node:assert/strict';
import { browserSocketAuth } from '../apps/web/src/lib/browser-socket-auth.js';

test('guest socket auth omits bearer credentials and reconnects read the current token', () => {
  let token = null;
  const storage = { getItem: () => token };
  assert.deepEqual(browserSocketAuth(storage), {});
  token = 'first-session';
  assert.deepEqual(browserSocketAuth(storage), {token: 'first-session'});
  token = 'rotated-session';
  assert.deepEqual(browserSocketAuth(storage), {token: 'rotated-session'});
  token = null;
  assert.deepEqual(browserSocketAuth(storage), {});
});
