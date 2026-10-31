import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import fixture from './fixtures/routes.json' with { type: 'json' };

process.env.JWT_SECRET = 'route-contract-test-secret';
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) return next(new URL(`../apps/web/src/${specifier.slice(2)}${specifier.endsWith('.js') ? '' : '.js'}`, import.meta.url).href, context);
  return next(specifier === 'next/server' ? 'next/server.js' : specifier, context);
} });
let unavailable = false;
const sql = Object.assign(async () => { throw Error('Unexpected domain query'); }, {
  query: async () => { if (unavailable) throw Error('private connection details'); return []; },
});
mock.module(new URL('../packages/core/src/db/client.js', import.meta.url).href, { defaultExport: sql });
mock.module(new URL('../apps/web/src/lib/queue/rateLimiter.js', import.meta.url).href, { namedExports: { checkRateLimit: async () => ({ allowed: true }) } });
const { generateToken } = await import('../packages/core/src/utils/auth.js');
const revoked = generateToken({ id: 1, role: 'admin', session_token: 'revoked' });
const publicMethods = new Set(['auth/login:POST', 'execute:GET', 'practice-run:GET', 'health:GET', 'live:GET', 'queue/stats:GET']);
const optionalMethods = new Set(['execute:POST', 'practice-run:POST', 'run:POST', 'submit:POST', 'c-run:POST', 'cpp-run:POST', 'java-run:POST', 'javascript-run:POST', 'python-run:POST', 'jobs/[jobId]:GET']);
const routes = [];
for (const [file, methods] of Object.entries(fixture).filter(([file]) => file.includes('/api/'))) {
  const name = file.split('/api/')[1].replace('/route.js', '');
  const module = await import(new URL(`../${file}`, import.meta.url));
  for (const method of methods) if (!publicMethods.has(`${name}:${method}`)) routes.push({ name, method, handler: module[method] });
}
function request(name, method, token) {
  return new Request(`http://localhost/api/${name.replace('[id]', '1').replace('[jobId]', 'job').replace('[username]', 'student')}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(!['GET', 'DELETE'].includes(method) ? { body: JSON.stringify({ code: 'print(1)', language: 'python', problemId: 'practical_1' }) } : {}),
  });
}
const context = () => ({ params: Promise.resolve({ id: '1', jobId: 'job', username: 'student' }) });

test('every protected API method rejects missing identity; optional execution routes reject invalid and revoked bearers', async () => {
  for (const { name, method, handler } of routes) {
    if (!optionalMethods.has(`${name}:${method}`)) {
      const response = await handler(request(name, method), context());
      assert.equal(response.status, 401, `${method} ${name}: missing bearer`);
    }
    for (const token of ['invalid-token', revoked]) {
      const response = await handler(request(name, method, token), context());
      assert.equal(response.status, 401, `${method} ${name}: invalid/revoked bearer`);
      assert.equal(typeof (await response.json()).error, 'string');
    }
  }
});

test('every authenticated API method fails closed with 503 when identity storage is unavailable', async () => {
  unavailable = true;
  try {
    for (const { name, method, handler } of routes) {
      const response = await handler(request(name, method, revoked), context());
      assert.equal(response.status, 503, `${method} ${name}`);
      assert.ok(!JSON.stringify(await response.json()).includes('private connection'));
    }
  } finally { unavailable = false; }
});
