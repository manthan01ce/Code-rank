import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

process.env.JWT_SECRET = 'test-only-secret-not-for-deployment';
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) return next(new URL(`../apps/web/src/${specifier.slice(2)}${specifier.endsWith('.js') ? '' : '.js'}`, import.meta.url).href, context);
  if (specifier === 'next/server') return next('next/server.js', context);
  return next(specifier, context);
} });

const { getUserFromRequest } = await import('../packages/core/src/utils/auth.js');
mock.module('@coderank/core/security/active-actor', { namedExports: {
  authenticateToken: async (token) => ({ id: 5, role: 'student' }),
  authenticateRequest: async (request, { optional = false } = {}) => {
    const user = getUserFromRequest(request);
    if (user) return user;
    const authHeader = typeof request.headers?.get === 'function' ? request.headers.get('authorization') : request.headers?.authorization;
    if (optional && !authHeader) return null;
    throw { status: 401, message: 'Authentication required' };
  }
} });

const jobs = new Map();
let rateAllowed = true;
const sql = async (strings) => {
  const query = strings.join('');
  if (query.includes('FROM practicals p')) return [{ id: 7, status: 'active', batch_id: 'A', semester: 3 }];
  if (query.includes('FROM users')) return [{ status: 'active', extra_info: { batch: 'A', semester: 3 } }];
  return [];
};
mock.module(new URL('../packages/core/src/db/client.js', import.meta.url).href, { defaultExport: sql });
mock.module('@coderank/database', { defaultExport: sql, namedExports: { closeDatabase: async () => {} } });
mock.module(new URL('../apps/web/src/lib/queue/rateLimiter.js', import.meta.url).href, { namedExports: { checkRateLimit: async () => ({ allowed: rateAllowed }) } });
mock.module(new URL('../apps/api/src/middleware/rate-limiter.js', import.meta.url).href, { namedExports: { checkRateLimit: async () => ({ allowed: rateAllowed }), closeRateLimiter: async () => {} } });
mock.module('@coderank/queue', { namedExports: { readExecutionWorkers: async () => ({ healthy: true, healthyWorkers: 1 }), createExecutionQueue: () => new class {
  async getWaitingCount() { return 0; }
  async add(type, data, opts) { const job = { id: opts.jobId, data, getState: async () => 'completed', returnvalue: { cases: [{ hidden: true, passed: true, input: 'SECRET', expected: 'SECRET' }] } }; jobs.set(job.id, job); return job; }
  async getJob(id) { return jobs.get(id); }
  async close() {}
  async disconnect() {}
} } });

const { generateToken } = await import('../packages/core/src/utils/auth.js');
const submitRoute = await import('../apps/web/src/app/api/submit/route.js');
const studentSubmit = await import('../apps/web/src/app/api/student/practicals/[id]/submit/route.js');
const { buildApp } = await import('../apps/api/src/app.js');
const api = buildApp();
await api.ready();
test.after(async () => { await api.close(); });

const token = generateToken({ id: 5, role: 'student' });
function request(path, body, auth = token, cookie) {
  return new Request(`http://localhost${path}`, { method: body ? 'POST' : 'GET', headers: { ...(auth ? { authorization: `Bearer ${auth}` } : {}), ...(cookie ? { cookie } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
}

async function apiCall(method, path, body, auth = token, cookie) {
  const headers = { 'content-type': 'application/json' };
  if (auth) headers.authorization = `Bearer ${auth}`;
  if (cookie) headers.cookie = cookie;
  const res = await api.inject({
    method,
    url: path,
    headers,
    payload: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
  });
  return {
    status: res.statusCode,
    headers: { get: name => res.headers[name.toLowerCase()] },
    json: async () => res.json(),
  };
}

test('all five language routes deny anonymous practical execution and accept assigned students', async () => {
  for (const lang of ['python', 'cpp', 'c', 'java', 'javascript']) {
    const body = { problemId: 'practical_7', code: 'valid source' };
    assert.equal((await apiCall('POST', `/api/${lang}-run`, body, null)).status, 401);
    assert.equal((await apiCall('POST', `/api/${lang}-run`, body)).status, 202);
  }
});

test('both submission entry points enforce role and shared validation/rate limits', async () => {
  const faculty = generateToken({ id: 1, role: 'faculty' });
  assert.equal((await submitRoute.POST(request('/api/submit', { code: 'x', language: 'python', problemId: 'practical_7' }, faculty))).status, 403);
  const context = { params: Promise.resolve({ id: '7' }) };
  assert.equal((await studentSubmit.POST(request('/api/student/practicals/7/submit', { code: 'x', language: 'invalid' }), context)).status, 400);
  rateAllowed = false;
  assert.equal((await studentSubmit.POST(request('/api/student/practicals/7/submit', { code: 'x', language: 'python' }), context)).status, 429);
  rateAllowed = true;
  assert.equal((await studentSubmit.POST(request('/api/student/practicals/7/submit', { code: 'x', language: 'python' }), context)).status, 202);
});

test('job endpoint denies cross-user reads and redacts hidden tests for the owner', async () => {
  const response = await apiCall('POST', '/api/execute', { language: 'python', code: 'print(1)' });
  const { jobId } = await response.json();
  assert.equal((await apiCall('GET', `/api/jobs/${jobId}`, null, generateToken({ id: 6, role: 'student' }))).status, 403);
  const owner = await apiCall('GET', `/api/jobs/${jobId}`, null);
  assert.equal(owner.status, 200);
  assert.deepEqual((await owner.json()).result.cases, [{ hidden: true, passed: true }]);
});

test('anonymous playground polling requires its HttpOnly browser session', async () => {
  const response = await apiCall('POST', '/api/execute', { language: 'python', code: 'print(1)' }, null);
  assert.equal(response.status, 202);
  assert.match(response.headers.get('set-cookie'), /HttpOnly/i);
  const cookie = response.headers.get('set-cookie').split(';')[0];
  const { jobId } = await response.json();
  assert.equal((await apiCall('GET', `/api/jobs/${jobId}`, null, null)).status, 403);
  assert.equal((await apiCall('GET', `/api/jobs/${jobId}`, null, null, cookie)).status, 200);
});

test('direct-Docker legacy practice path now queues and validates payloads', async () => {
  const response = await apiCall('POST', '/api/practice-run', { code: 'print(1)', stdin: 'input' }, null);
  assert.equal(response.status, 202);
  assert.equal(jobs.get((await response.json()).jobId).data.type, 'playground');
  assert.equal((await apiCall('POST', '/api/practice-run', { code: 'print(1)', input: {} }, null)).status, 400);
});

test('prototype-property problem identifiers cannot enqueue an empty test suite', async () => {
  assert.equal((await apiCall('POST', '/api/run', { language: 'python', code: 'x', problemId: '__proto__' })).status, 404);
});

test('workspace routes enforce practical membership and bounded source input', async () => {
  const save = await import('../apps/web/src/app/api/student/workspaces/save/route.js');
  assert.equal((await save.POST(request('/api/student/workspaces/save', { practical_id: 7, language: 'python', code: 'print("你好")' }))).status, 200);
  assert.equal((await save.POST(request('/api/student/workspaces/save', { practical_id: '7junk', language: 'python', code: '' }))).status, 400);
  assert.equal((await save.POST(request('/api/student/workspaces/save', { practical_id: 7, language: 'unknown', code: '' }))).status, 400);
  assert.equal((await save.POST(request('/api/student/workspaces/save', { practical_id: 7, language: 'python', code: 'x'.repeat(131073) }))).status, 400);
  assert.equal((await save.POST(request('/api/student/workspaces/save', { practical_id: 7, language: 'python', code: '' }, null))).status, 401);
});
