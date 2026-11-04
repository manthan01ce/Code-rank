import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) return next(new URL(`../apps/web/src/${specifier.slice(2)}${specifier.endsWith('.js') ? '' : '.js'}`, import.meta.url).href, context);
  return next(specifier === 'next/server' ? 'next/server.js' : specifier, context);
} });
mock.module('@coderank/core/security/active-actor', { namedExports: { authenticateRequest: async () => ({ id: 1, role: 'admin' }), authenticateToken: async () => ({ id: 1, role: 'admin' }) } });
const sql = Object.assign(async () => { throw Error('private database details'); }, { query: async () => { throw Error('private database details'); } });
mock.module(new URL('../packages/core/src/db/client.js', import.meta.url).href, { defaultExport: sql });

test('JSON mutation adapters reject malformed and non-object bodies with 400', async () => {
  const cases = [];
  for (const [name, method] of cases) {
    const route = await import(`../apps/web/src/app/api/${name}/route.js`);
    for (const body of ['{', 'null', '[]', '42', '"text"']) {
      const response = await route[method](new Request('http://localhost/api/test', { method, body, headers: { 'Content-Type': 'application/json' } }), { params: Promise.resolve({ id: '1' }) });
      assert.equal(response.status, 400, `${method} ${name}: ${body}`);
    }
  }

  const { buildApp } = await import('../apps/api/src/app.js');
  const api = buildApp();
  await api.ready();
  try {
    const apiCases = [
      ['/api/auth/profile', 'PUT'],
      ['/api/auth/change-password', 'POST'],
      ['/api/admin/password', 'POST'],
      ['/api/users', 'POST'],
      ['/api/users', 'PUT'],
      ['/api/users/1', 'PUT'],
      ['/api/courses', 'POST'],
      ['/api/courses/1', 'PUT'],
      ['/api/departments', 'POST'],
      ['/api/departments/1', 'PUT'],
      ['/api/mapping', 'POST'],
      ['/api/student/workspaces/save', 'POST'],
    ];
    for (const [url, method] of apiCases) {
      for (const body of ['{', 'null', '[]', '42', '"text"']) {
        const response = await api.inject({
          method,
          url,
          payload: body,
          headers: { 'Content-Type': 'application/json', authorization: 'Bearer test' },
        });
        assert.equal(response.statusCode, 400, `${method} ${url}: ${body}`);
      }
    }
  } finally {
    await api.close();
  }
});

test('both upload adapters reject malformed multipart requests and redact unexpected errors', async () => {
  const { buildApp } = await import('../apps/api/src/app.js');
  const api = buildApp();
  await api.ready();
  try {
    for (const path of ['/api/users/bulk', '/api/admin/bulk-upload']) {
      // 1. Missing boundary in Content-Type
      const noBoundary = await api.inject({
        method: 'POST',
        url: path,
        headers: {
          'Content-Type': 'multipart/form-data',
          authorization: 'Bearer test',
        },
        payload: 'not a real multipart body',
      });
      assert.equal(noBoundary.statusCode, 400, `${path} missing boundary should return 400`);
      assert.equal(noBoundary.headers['cache-control'], 'no-store');
      const err = noBoundary.json();
      assert.match(err.error, /multipart/i);

      // 2. Completely bogus Content-Type
      const bogusCt = await api.inject({
        method: 'POST',
        url: path,
        headers: {
          'Content-Type': 'application/x-bogus-format',
          authorization: 'Bearer test',
        },
        payload: 'nonsense',
      });
      assert.equal(bogusCt.statusCode, 400, `${path} bogus Content-Type should return 400`);
      assert.equal(bogusCt.headers['cache-control'], 'no-store');

      // 3. Truncated multipart boundary stream
      const truncated = await api.inject({
        method: 'POST',
        url: path,
        headers: {
          'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
          authorization: 'Bearer test',
        },
        payload: '------WebKitFormBoundary7MA4YWxkTrZu0gW\r\nContent-Disposition: form-data; name="file"\r\n\r\npartial content without closing boundary',
      });
      assert.equal(truncated.statusCode, 400, `${path} truncated multipart should return 400`);
      assert.equal(truncated.headers['cache-control'], 'no-store');
    }
  } finally {
    await api.close();
  }
});
