import test from 'node:test';
import assert from 'node:assert/strict';
process.env.JWT_SECRET = 'active-actor-isolated-test-secret';
const { generateToken } = await import('../packages/core/src/utils/auth.js');
const { authenticateToken, authenticateRequest } = await import('../packages/core/src/security/active-actor.js');
const actor = { id: 7, name: 'Current name', email: 'actor@example.test', role: 'faculty', status: 'active', session_token: 'current-session' };
const token = generateToken(actor);
const query = async (_sql, params) => { assert.deepEqual(params, [7]); return [actor]; };
const denied = status => error => error.status === status;

test('active authentication validates database identity, roles and current session', async () => {
  for (const role of ['student', 'faculty', 'admin']) {
    const row = { ...actor, role };
    const result = await authenticateToken(generateToken({ ...row, name: 'Old name' }), { query: async () => [row] });
    assert.equal(result.name, actor.name);
    assert.equal(result.role, role);
  }
  await authenticateToken(token, { query });
  for (const row of [null, { ...actor, status: 'inactive' }, { ...actor, role: 'student' }, { ...actor, session_token: 'revoked' }, { ...actor, session_token: null }]) {
    await assert.rejects(authenticateToken(token, { query: async () => row ? [row] : [] }), denied(401));
  }
});

test('legacy sessionless accounts remain compatible until a session is established', async () => {
  const legacyToken = generateToken({ ...actor, session_token: undefined });
  await authenticateToken(legacyToken, { query: async () => [{ ...actor, session_token: null }] });
  await assert.rejects(authenticateToken(legacyToken, { query }), denied(401));
});

test('invalid tokens and nonpersistent identities never reach database authentication', async () => {
  const neverQuery = () => assert.fail('Invalid identity must not query database');
  for (const value of ['', undefined, 'invalid', generateToken({ ...actor, id: 0 }), generateToken({ ...actor, id: -1 })]) {
    await assert.rejects(authenticateToken(value, { query: neverQuery }), denied(401));
  }
});

test('optional authentication only permits absence of credentials, never invalid bearer downgrade', async () => {
  assert.equal(await authenticateRequest({ headers: new Headers() }, { optional: true, query }), null);
  await assert.rejects(authenticateRequest({ headers: {} }, { query }), denied(401));
  for (const authorization of ['', 'Basic credentials', 'Bearer invalid', `Bearer ${token} extra`]) {
    await assert.rejects(authenticateRequest({ headers: new Headers({ authorization }) }, { optional: true, query }), denied(401));
  }
  assert.equal((await authenticateRequest({ headers: { authorization: `Bearer ${token}` } }, { query })).id, 7);
});

test('authentication lookup outages fail closed with service unavailable', async () => {
  await assert.rejects(authenticateToken(token, { query: async () => { throw new Error('private connection details'); } }), error => {
    assert.equal(error.status, 503);
    assert.equal(error.message, 'Authentication service unavailable');
    return true;
  });
});

test('deactivated students, faculty and administrators cannot reuse otherwise valid sessions', async () => {
  for (const role of ['student', 'faculty', 'admin']) {
    const row = { ...actor, role, status: 'inactive' };
    await assert.rejects(authenticateToken(generateToken({ ...row, status: 'active' }), { query: async () => [row] }), denied(401));
  }
});
