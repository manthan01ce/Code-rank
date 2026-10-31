import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) return next(new URL(`../apps/web/src/${specifier.slice(2)}${specifier.endsWith('.js') ? '' : '.js'}`, import.meta.url).href, context);
  return next(specifier === 'next/server' ? 'next/server.js' : specifier, context);
} });
mock.module('@coderank/core/security/active-actor', { namedExports: { authenticateRequest: async () => ({ id: 1, role: 'admin' }) } });
const sql = Object.assign(async () => { throw Error('private database details'); }, { query: async () => { throw Error('private database details'); } });
mock.module(new URL('../packages/core/src/db/client.js', import.meta.url).href, { defaultExport: sql });

test('JSON mutation adapters reject malformed and non-object bodies with 400', async () => {
  const cases = [['auth/profile','PUT'],['auth/change-password','POST'],['admin/password','POST'],['courses','POST'],['courses/[id]','PUT'],['departments','POST'],['departments/[id]','PUT'],['student/workspaces/save','POST'],['users','PUT'],['users','POST'],['users/[id]','PUT'],['mapping','POST']];
  for (const [name, method] of cases) {
    const route = await import(`../apps/web/src/app/api/${name}/route.js`);
    for (const body of ['{', 'null', '[]', '42', '"text"']) {
      const response = await route[method](new Request('http://localhost/api/test', { method, body, headers: { 'Content-Type': 'application/json' } }), { params: Promise.resolve({ id: '1' }) });
      assert.equal(response.status, 400, `${method} ${name}: ${body}`);
    }
  }
});

test('both upload adapters reject malformed multipart requests and redact unexpected errors', async () => {
  for (const name of ['users/bulk', 'admin/bulk-upload']) {
    const { POST } = await import(`../apps/web/src/app/api/${name}/route.js`);
    assert.equal((await POST(new Request('http://localhost/api/test', { method: 'POST', body: '{}' }))).status, 400);
    const response = await POST({ formData: async () => { throw { status: 0, message: 'private database details' }; } });
    assert.ok(!JSON.stringify(await response.json()).includes('private database'));
  }
});

test('legacy profile adapter never exposes unexpected database errors', async () => {
  const { PUT } = await import('../apps/web/src/app/api/profile/[username]/route.js');
  const response = await PUT(new Request('http://localhost/api/profile/student', { method: 'PUT', body: '{}' }));
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Internal server error' });
});

test('execution connectivity returns 503 for cached fallback and redacts queue failures', async () => {
  const { SubmissionService } = await import('../packages/core/src/modules/submissions/SubmissionService.js');
  const { GET } = await import('../apps/web/src/app/api/execute/route.js');
  const stub = mock.method(SubmissionService, 'getQueueStats', async () => ({ cached: true, waiting: 0 }));
  try {
    const response = await GET();
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal((await response.json()).status, 'degraded');
    stub.mock.mockImplementation(async () => { throw Error('private Redis connection details'); });
    const failed = await GET();
    assert.equal(failed.status, 503);
    assert.ok(!JSON.stringify(await failed.json()).includes('private Redis'));
  } finally { stub.mock.restore(); }
});

test('admin statistics read the database service on every request with no replica-local response cache', async () => {
  const { OperationsService } = await import('../packages/core/src/modules/reports/OperationsService.js');
  const { GET } = await import('../apps/web/src/app/api/stats/route.js');
  let calls=0;
  const stub=mock.method(OperationsService,'stats',async()=>({faculty:1,students:++calls,courses:1}));
  try {
    const first=await GET(new Request('http://localhost/api/stats'));
    const second=await GET(new Request('http://localhost/api/stats'));
    assert.equal((await first.json()).students,1);
    assert.equal((await second.json()).students,2);
    assert.equal(second.headers.get('Cache-Control'),'no-store');
  } finally { stub.mock.restore(); }
});
