import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import inventory from '../docs/architecture/route-inventory.json' with { type: 'json' };

process.env.JWT_SECRET = 'route-contract-test-secret';
let unavailable = false;
const sql = Object.assign(async () => { throw Error('Unexpected domain query'); }, {
  query: async () => { if (unavailable) throw Error('private connection details'); return []; },
});
mock.module(new URL('../packages/core/src/db/client.js', import.meta.url).href, { defaultExport: sql });
mock.module('@coderank/database', { defaultExport: sql, namedExports: { closeDatabase: async () => {} } });
mock.module('../apps/api/src/middleware/rate-limiter.js', { namedExports: {
  checkRateLimit: async () => ({ allowed: true }), closeRateLimiter: async () => {},
} });
const { generateToken } = await import('../packages/core/src/utils/auth.js');
const { buildApp } = await import('../apps/api/src/app.js');
const app = buildApp();
await app.ready();
test.after(() => app.close());
const revoked = generateToken({ id: 1, role: 'admin', session_token: 'revoked' });
const routes = inventory.endpoints.filter(item => item.auth !== 'none').flatMap(item => item.methods
  .filter(method => !(method === 'GET' && ['/api/execute', '/api/practice-run'].includes(item.url)))
  .map(method => ({ ...item, method, path: item.url.replace(/\[id\]/g, '1').replace('[jobId]', 'job').replace('[username]', 'student') })));
function request(route, token) {
  return app.inject({ method: route.method, url: route.path,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(!['GET', 'DELETE'].includes(route.method) ? { payload: { code: 'print(1)', language: 'python', problemId: 'practical_1' } } : {}),
  });
}

test('every protected API method rejects missing identity; optional execution routes reject invalid and revoked bearers', async () => {
  assert.equal(inventory.endpoints.length, 47);
  assert.ok(routes.length >= 47, 'migration must not silently empty this security matrix');
  for (const route of routes) {
    if (route.auth !== 'optional') assert.equal((await request(route)).statusCode, 401, `${route.method} ${route.url}: missing bearer`);
    for (const token of ['invalid-token', revoked]) {
      const response = await request(route, token);
      assert.equal(response.statusCode, 401, `${route.method} ${route.url}: invalid/revoked bearer`);
      assert.equal(typeof response.json().error, 'string');
    }
  }
});

test('every authenticated API method fails closed with 503 when identity storage is unavailable', async () => {
  unavailable = true;
  try {
    assert.ok(routes.length >= 47);
    for (const route of routes) {
      const response = await request(route, revoked);
      assert.equal(response.statusCode, 503, `${route.method} ${route.url}`);
      assert.ok(!JSON.stringify(response.json()).includes('private connection'));
    }
  } finally { unavailable = false; }
});
