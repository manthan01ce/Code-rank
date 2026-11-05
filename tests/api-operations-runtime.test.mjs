import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { PGlite } from '@electric-sql/pglite';
import { migrate } from '../packages/database/src/migrations.js';
import { createApiGateway } from '../infrastructure/gateway/proxy.mjs';
import { generateToken } from '../packages/core/src/utils/auth.js';

process.env.JWT_SECRET = 'operations-runtime-test-secret-32-chars';

const db = new PGlite();

await migrate(
  {
    query: async (q, p) => (await db.query(q, p)).rows,
    apply: m =>
      db.transaction(async tx => {
        for (const s of m.statements) await tx.exec(s);
        await tx.query('INSERT INTO coderank_migrations(name,checksum) VALUES($1,$2)', [m.name, m.checksum]);
      }),
  },
  new URL('../packages/database/migrations/', import.meta.url)
);

await db.exec(`
  INSERT INTO users(id, name, email, password, role, extra_info, status, session_token)
  VALUES
    (1, 'Admin User', 'admin@test.com', 'x', 'admin', '{}', 'active', 'session-admin'),
    (2, 'Faculty User', 'faculty@test.com', 'x', 'faculty', '{"department":"CS"}', 'active', 'session-faculty'),
    (3, 'Student User', 'student@test.com', 'x', 'student', '{"semester":1,"batch":"Batch A","division":"Div A"}', 'active', 'session-student');
  SELECT setval('users_id_seq', (SELECT max(id) FROM users));

  INSERT INTO courses(id, name, course_code, semester)
  VALUES (1, 'Algorithms', 'CS201', 1);
  SELECT setval('courses_id_seq', 1);

  INSERT INTO practicals(id, course_id, faculty_id, batch_id, title, total_marks, status, created_at)
  VALUES (1, 1, 2, 'Batch A', 'Practical One', 100, 'active', now());
  SELECT setval('practicals_id_seq', 1);

  INSERT INTO practical_submissions(id, student_id, practical_id, language, code, status, raw_marks, normalized_marks, submitted_at)
  VALUES (1, 3, 1, 'python', convert_to('secret-submission-code', 'UTF8'), 'completed', 100, 100, now());
  SELECT setval('practical_submissions_id_seq', 1);

  INSERT INTO activity_logs(id, user_id, action, details, created_at)
  VALUES
    (1, 1, 'LOGIN', 'Admin logged in', now()),
    (2, 2, 'CREATE_PRACTICAL', 'Faculty created practical', now());
  SELECT setval('activity_logs_id_seq', 2);
`);

function sqlTagged(strings, ...values) {
  let text = '';
  const params = [];
  for (let i = 0; i < strings.length; i++) {
    text += strings[i];
    if (i < values.length) {
      params.push(values[i]);
      text += `$${params.length}`;
    }
  }
  return db.query(text, params).then(res => res.rows);
}

sqlTagged.query = async (queryText, params = []) => {
  const res = await db.query(queryText, params);
  return res.rows;
};

test.mock.module('@coderank/database', {
  defaultExport: sqlTagged,
  namedExports: {
    closeDatabase: async () => {},
  },
});

test.mock.module(new URL('../packages/core/src/db/client.js', import.meta.url).href, {
  defaultExport: sqlTagged,
});

test.mock.module('@coderank/queue', {
  namedExports: {
    readExecutionWorkers: async () => ({ healthy: true, healthyWorkers: 2 }),
    createExecutionQueue: () => ({
      getWaitingCount: async () => 3,
      getActiveCount: async () => 1,
      close: async () => {},
      disconnect: async () => {},
    }),
  },
});

const { buildApp } = await import('../apps/api/src/app.js');
const { OperationsService } = await import('../apps/api/src/modules/operations/operations.service.js');

test('Fastify operations, readiness and profile runtime contracts direct and via gateway', async (t) => {
  const app = buildApp();
  const apiAddress = await app.listen({ host: '127.0.0.1', port: 0 });

  const proxyApi = createApiGateway({ origin: apiAddress });
  const gateway = http.createServer((req, res) => {
    if (!proxyApi(req, res)) {
      res.writeHead(418, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
      res.end('web-fallback');
    }
  });

  await new Promise(resolve => gateway.listen(0, '127.0.0.1', resolve));
  const gatewayAddress = `http://127.0.0.1:${gateway.address().port}`;

  t.after(async () => {
    proxyApi.close();
    await app.close();
    await new Promise(resolve => gateway.close(resolve));
    await db.close();
  });

  const adminToken = generateToken({ id: 1, name: 'Admin User', email: 'admin@test.com', role: 'admin', session_token: 'session-admin' });
  const studentToken = generateToken({ id: 3, name: 'Student User', email: 'student@test.com', role: 'student', session_token: 'session-student' });

  await t.test('GET /api/live returns status ok, timestamp and no-store (direct & gateway)', async () => {
    for (const base of [apiAddress, gatewayAddress]) {
      const res = await fetch(`${base}/api/live`);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('cache-control'), 'no-store');
      const body = await res.json();
      assert.equal(body.status, 'ok');
      assert.ok(typeof body.timestamp === 'string');
    }
  });

  await t.test('GET /api/health evaluates readiness with in-memory caching (direct & gateway)', async () => {
    OperationsService.resetCaches();

    // First call: cache MISS
    const res1 = await fetch(`${apiAddress}/api/health`);
    assert.equal(res1.status, 200);
    assert.equal(res1.headers.get('cache-control'), 'no-store');
    assert.equal(res1.headers.get('x-cache'), 'MISS');
    const body1 = await res1.json();
    assert.equal(body1.status, 'healthy');
    assert.equal(body1.services.database.status, 'healthy');
    assert.equal(body1.services.database.schema, 'current');
    assert.equal(body1.services.queue.status, 'healthy');
    assert.equal(body1.services.execution.status, 'healthy');
    assert.equal(body1.services.execution.healthyWorkers, 2);

    // Second call: cache HIT
    const res2 = await fetch(`${gatewayAddress}/api/health`);
    assert.equal(res2.status, 200);
    assert.equal(res2.headers.get('cache-control'), 'no-store');
    assert.equal(res2.headers.get('x-cache'), 'HIT');
    const body2 = await res2.json();
    assert.equal(body2.status, 'healthy');
  });

  await t.test('GET /api/health/detailed requires administrator authorization', async () => {
    // Unauthenticated -> 401
    const unauth = await fetch(`${apiAddress}/api/health/detailed`);
    assert.equal(unauth.status, 401);
    assert.equal(unauth.headers.get('cache-control'), 'no-store');

    // Student -> 401
    const student = await fetch(`${apiAddress}/api/health/detailed`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(student.status, 401);

    // Admin (direct & gateway) -> 200
    for (const base of [apiAddress, gatewayAddress]) {
      const admin = await fetch(`${base}/api/health/detailed`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(admin.status, 200);
      assert.equal(admin.headers.get('cache-control'), 'no-store');
      const body = await admin.json();
      assert.ok(body.systemInfo);
      assert.ok(body.connectionPools);
      assert.ok(body.circuitBreakers);
      assert.ok(body.queueStats);
    }
  });

  await t.test('GET /api/logs returns audit records for administrator and validates limits', async () => {
    // Unauthorized
    const unauth = await fetch(`${apiAddress}/api/logs`);
    assert.equal(unauth.status, 401);

    // Student -> 401
    const student = await fetch(`${apiAddress}/api/logs`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(student.status, 401);

    // Invalid limits -> 400
    for (const limit of ['invalid', '-5', '105', '0']) {
      const bad = await fetch(`${apiAddress}/api/logs?limit=${limit}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(bad.status, 400);
    }

    // Admin -> 200 (direct & gateway)
    for (const base of [apiAddress, gatewayAddress]) {
      const res = await fetch(`${base}/api/logs?limit=10`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('cache-control'), 'no-store');
      const logs = await res.json();
      assert.ok(Array.isArray(logs));
      assert.ok(logs.length >= 2);
      assert.equal(logs[0].action, 'CREATE_PRACTICAL');
    }
  });

  await t.test('GET /api/metrics exposes HTTP telemetries to administrator', async () => {
    // Unauthorized
    const unauth = await fetch(`${apiAddress}/api/metrics`);
    assert.equal(unauth.status, 401);

    // Student -> 401
    const student = await fetch(`${apiAddress}/api/metrics`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(student.status, 401);

    // Admin -> 200 (direct & gateway)
    for (const base of [apiAddress, gatewayAddress]) {
      const res = await fetch(`${base}/api/metrics`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('cache-control'), 'no-store');
      const metrics = await res.json();
      assert.ok(typeof metrics.uptimeSeconds === 'number');
      assert.ok(typeof metrics.requests === 'number');
      assert.ok(metrics.latencyMs);
      assert.ok(metrics.process);
      assert.ok(Array.isArray(metrics.endpoints));
    }
  });

  await t.test('GET /api/queue/stats is public and returns queue statistics with caching', async () => {
    OperationsService.resetCaches();

    // Direct
    const direct = await fetch(`${apiAddress}/api/queue/stats`);
    assert.equal(direct.status, 200);
    assert.match(direct.headers.get('cache-control') || '', /public/);
    assert.equal(direct.headers.get('x-cache'), 'MISS');
    const directBody = await direct.json();
    assert.ok(typeof directBody.waiting === 'number');
    assert.ok(typeof directBody.active === 'number');

    // Gateway (cache HIT)
    const gw = await fetch(`${gatewayAddress}/api/queue/stats`);
    assert.equal(gw.status, 200);
    assert.match(gw.headers.get('cache-control') || '', /public/);
    assert.equal(gw.headers.get('x-cache'), 'HIT');
  });

  await t.test('GET /api/stats returns system counters for administrator', async () => {
    // Unauthorized
    const unauth = await fetch(`${apiAddress}/api/stats`);
    assert.equal(unauth.status, 401);

    // Student -> 401
    const student = await fetch(`${apiAddress}/api/stats`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(student.status, 401);

    // Admin (direct & gateway)
    for (const base of [apiAddress, gatewayAddress]) {
      const res = await fetch(`${base}/api/stats`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('cache-control'), 'no-store');
      const stats = await res.json();
      assert.equal(stats.faculty, 1);
      assert.equal(stats.students, 1);
      assert.equal(stats.courses, 1);
    }
  });

  await t.test('GET /api/profile/[username] requires auth, sanitizes passwords and source code', async () => {
    // Unauthenticated -> 401
    const unauth = await fetch(`${apiAddress}/api/profile/student@test.com`);
    assert.equal(unauth.status, 401);

    // Invalid handle -> 400
    const invalidHandle = await fetch(`${apiAddress}/api/profile/%20%20`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(invalidHandle.status, 400);

    // Not found -> 404
    const notFound = await fetch(`${apiAddress}/api/profile/nonexistent_user`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(notFound.status, 404);

    // Found (direct & gateway)
    for (const base of [apiAddress, gatewayAddress]) {
      const res = await fetch(`${base}/api/profile/student@test.com`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('cache-control'), 'no-store');
      const profile = await res.json();
      assert.equal(profile.user.id, 3);
      assert.equal(profile.user.name, 'Student User');
      assert.equal(profile.user.password, undefined, 'password must not be serialized');
      assert.ok(Array.isArray(profile.submissions));
      assert.equal(profile.submissions.length, 1);
      assert.equal(profile.submissions[0].code, undefined, 'submission code must not be serialized');
      assert.equal(profile.submissions[0].testcase_results, undefined);
    }
  });

  await t.test('PUT /api/profile/[username] validates JSON and updates caller biography', async () => {
    // Unauthenticated -> 401
    const unauth = await fetch(`${apiAddress}/api/profile/student@test.com`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Name' }),
    });
    assert.equal(unauth.status, 401);

    // Malformed JSON / invalid payload -> 400
    for (const badBody of ['{', 'null', '[]', '42', '"text"']) {
      const bad = await fetch(`${apiAddress}/api/profile/student@test.com`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
        body: badBody,
      });
      assert.equal(bad.status, 400);
    }

    // Valid update (direct)
    const directRes = await fetch(`${apiAddress}/api/profile/student@test.com`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ name: 'Student Updated Name' }),
    });
    assert.equal(directRes.status, 200);
    const directBody = await directRes.json();
    assert.equal(directBody.success, true);

    // Valid update (via gateway)
    const gwRes = await fetch(`${gatewayAddress}/api/profile/student@test.com`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ name: 'Student Gateway Updated' }),
    });
    assert.equal(gwRes.status, 200);
    const gwBody = await gwRes.json();
    assert.equal(gwBody.success, true);
  });

  await t.test('Method Not Allowed (405) contracts on all operations and profile endpoints', async () => {
    const checks = [
      ['/api/live', ['POST', 'PUT', 'DELETE', 'PATCH'], 'GET, HEAD, OPTIONS'],
      ['/api/health', ['POST', 'PUT', 'DELETE', 'PATCH'], 'GET, HEAD, OPTIONS'],
      ['/api/health/detailed', ['POST', 'PUT', 'DELETE', 'PATCH'], 'GET, HEAD, OPTIONS'],
      ['/api/logs', ['POST', 'PUT', 'DELETE', 'PATCH'], 'GET, HEAD, OPTIONS'],
      ['/api/metrics', ['POST', 'PUT', 'DELETE', 'PATCH'], 'GET, HEAD, OPTIONS'],
      ['/api/queue/stats', ['POST', 'PUT', 'DELETE', 'PATCH'], 'GET, HEAD, OPTIONS'],
      ['/api/stats', ['POST', 'PUT', 'DELETE', 'PATCH'], 'GET, HEAD, OPTIONS'],
      ['/api/profile/test_user', ['POST', 'DELETE', 'PATCH'], 'GET, HEAD, OPTIONS, PUT'],
    ];

    for (const [url, methods, allowHeader] of checks) {
      for (const method of methods) {
        const res = await fetch(`${apiAddress}${url}`, { method });
        assert.equal(res.status, 405, `${method} ${url} must return 405`);
        assert.equal(res.headers.get('cache-control'), 'no-store');
        assert.equal(res.headers.get('allow'), allowHeader);
      }
    }
  });

  await t.test('Gateway bypasses non-migrated paths to web fallback (418)', async () => {
    const res = await fetch(`${gatewayAddress}/unmigrated-page`);
    assert.equal(res.status, 418);
    assert.equal(await res.text(), 'web-fallback');
  });
});
