import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

// Runs only against the authenticated harness disposable account/database.
export async function verifyAuthContracts({ base, apiBase, email, password, secret, deactivate }) {
  const call = (origin, path, { method = 'GET', token, body, raw } = {}) => fetch(`${origin}/api/auth/${path}`, {
    method, signal: AbortSignal.timeout(10000),
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined || raw !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    ...(body !== undefined || raw !== undefined ? { body: raw ?? JSON.stringify(body) } : {}),
  });
  const login = async (origin, value = password) => {
    const response = await call(origin, 'login', { method: 'POST', body: { email, password: value } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(response.headers.get('server-timing'), /lookup/);
    return (await response.json()).token;
  };
  for (const origin of [apiBase, base]) {
    const malformed = await call(origin, 'login', { method: 'POST', raw: '{' });
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), { error: 'Invalid JSON' });
    const unauthorized = await call(origin, 'change-password', { method: 'POST', raw: '{' });
    assert.equal(unauthorized.status, 401, 'Authenticate before parsing protected bodies');
    assert.equal((await call(origin, 'profile', { token: 'invalid-token' })).status, 401);
  }
  const old = await login(apiBase);
  let response = await call(base, 'profile', { token: old });
  assert.equal(response.status, 200);
  const profile = (await response.json()).user;
  assert.equal(profile.email, email);
  assert.equal(profile.password, undefined);
  assert.equal(profile.session_token, undefined);
  let token = await login(base);
  assert.equal((await call(apiBase, 'profile', { token: old })).status, 401, 'Login rotates the database session');
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url'));
  const signed = payload => {
    const input = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
    return `${input}.${createHmac('sha256', secret).update(input).digest('base64url')}`;
  };
  assert.equal((await call(apiBase, 'profile', { token: signed(claims) })).status, 200, 'Signed negative fixtures use the real server key');
  for (const bad of [signed({ ...claims, exp: Math.floor(Date.now() / 1000) - 60 }), signed({ ...claims, role: 'admin' })]) {
    for (const origin of [apiBase, base]) assert.equal((await call(origin, 'profile', { token: bad })).status, 401);
  }
  response = await call(apiBase, 'profile', { method: 'PUT', token, body: { name: 'Auth Contract Updated' } });
  assert.equal(response.status, 200);
  assert.equal((await (await call(base, 'profile', { token })).json()).user.name, 'Auth Contract Updated');
  const malformed = await call(apiBase, 'profile', { method: 'PUT', token, raw: '{' });
  assert.equal(malformed.status, 400);
  assert.deepEqual(await malformed.json(), { error: 'Invalid JSON payload' });
  const newPassword = `${password}-rotated`;
  response = await call(base, 'change-password', { method: 'POST', token, body: { currentPassword: password, newPassword } });
  assert.equal(response.status, 200);
  const replacement = (await response.json()).token;
  assert.ok(replacement);
  assert.equal((await call(apiBase, 'profile', { token })).status, 401);
  assert.equal((await call(apiBase, 'profile', { token: replacement })).status, 200);
  assert.equal((await call(apiBase, 'login', { method: 'POST', body: { email, password } })).status, 401);
  token = await login(base, newPassword);
  await deactivate();
  for (const origin of [apiBase, base]) assert.equal((await call(origin, 'profile', { token })).status, 401, 'Deactivation applies on the next request');

  // A distinct non-account email isolates this window from the login lifecycle above.
  const throttleEmail = `throttle-${email}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    assert.equal((await call(apiBase, 'login', { method: 'POST', body: { email: throttleEmail, password } })).status, 401);
  }
  response = await call(base, 'login', { method: 'POST', body: { email: throttleEmail, password } });
  assert.equal(response.status, 429);
  assert.equal(Number(response.headers.get('retry-after')), 60);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  console.log('Auth HTTP contracts passed: direct API, production gateway, sessions, expiry, role authority, account lifecycle and real Redis throttling');
}
