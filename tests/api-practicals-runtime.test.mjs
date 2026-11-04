import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { PGlite } from '@electric-sql/pglite';
import { migrate } from '../packages/database/src/migrations.js';
import { createApiGateway } from '../infrastructure/gateway/proxy.mjs';

process.env.JWT_SECRET = 'practicals-runtime-test-secret-32-chars';

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
  new URL('../database/migrations/', import.meta.url)
);

await db.exec(`
  INSERT INTO users(id, name, email, password, role, extra_info, status)
  VALUES
    (1, 'Admin User', 'admin@test.com', 'x', 'admin', '{}', 'active'),
    (2, 'Faculty User', 'faculty@test.com', 'x', 'faculty', '{"department":"CS"}', 'active'),
    (3, 'Student User', 'student@test.com', 'x', 'student', '{"semester":1,"batch":"Batch A","division":"Div A"}', 'active');
  SELECT setval('users_id_seq', (SELECT max(id) FROM users));

  INSERT INTO departments(id, name, institute_name)
  VALUES (1, 'Computer Science', 'Engineering Institute');
  SELECT setval('departments_id_seq', 1);

  INSERT INTO courses(id, name, course_code, semester)
  VALUES (1, 'Data Structures', 'CS101', 1);
  SELECT setval('courses_id_seq', 1);

  INSERT INTO course_faculty(course_id, faculty_id, is_co_coordinator)
  VALUES (1, 2, true);
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

const sql = Object.assign(sqlTagged, {
  query: async (text, params = []) => (await db.query(text, params)).rows,
  readQuery: async (text, params = []) => (await db.query(text, params)).rows,
});

mock.module('@coderank/database', {
  defaultExport: sql,
  namedExports: {
    closeDatabase: async () => {},
  },
});

const { generateToken, getUserFromRequest } = await import('../packages/core/src/utils/auth.js');

mock.module('@coderank/core/security/active-actor', {
  namedExports: {
    authenticateRequest: async (request, { optional = false } = {}) => {
      const header = request?.headers?.get?.('authorization') || request?.headers?.authorization;
      if (optional && !header) return null;
      const actor = header && getUserFromRequest(request);
      if (!actor) throw { status: 401, message: 'Authentication required' };
      return actor;
    },
    authenticateToken: async token => {
      if (!token) throw { status: 401, message: 'Authentication required' };
      const actor = getUserFromRequest({ headers: { authorization: `Bearer ${token}` } });
      if (!actor) throw { status: 401, message: 'Authentication required' };
      return actor;
    },
  },
});

const { buildApp } = await import('../apps/api/src/app.js');

test('Fastify practicals and practical reporting HTTP contracts direct and via gateway', async t => {
  const realtimeEvents = [];
  const app = buildApp();
  await app.ready();

  const originalPublish = app.publisher.publishPracticalChange;
  app.publisher.publishPracticalChange = (action, payload) => {
    realtimeEvents.push({ action, payload });
    return originalPublish.call(app.publisher, action, payload);
  };

  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  t.after(async () => {
    await app.close();
    await db.close();
  });

  const proxy = createApiGateway({ origin: address });
  const gateway = http.createServer((req, res) => {
    if (!proxy(req, res)) {
      res.statusCode = 404;
      res.end('web: not proxied');
    }
  });
  await new Promise(resolve => gateway.listen(0, '127.0.0.1', resolve));
  const gatewayAddress = `http://127.0.0.1:${gateway.address().port}`;
  t.after(() => new Promise(resolve => gateway.close(resolve)));

  const adminToken = generateToken({ id: 1, role: 'admin' });
  const facultyToken = generateToken({ id: 2, role: 'faculty' });
  const studentToken = generateToken({ id: 3, role: 'student' });

  // 1. GET /api/faculty/batches
  {
    const unauth = await fetch(`${address}/api/faculty/batches`);
    assert.equal(unauth.status, 401);

    const res = await fetch(`${address}/api/faculty/batches`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.ok(res.headers.has('x-next-cursor'));
    const batches = await res.json();
    assert.ok(Array.isArray(batches));
    assert.ok(batches.includes('Batch A'));
  }

  // 2. GET /api/faculty/courses
  {
    const unauth = await fetch(`${address}/api/faculty/courses`);
    assert.equal(unauth.status, 401);

    const studentRes = await fetch(`${address}/api/faculty/courses`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(studentRes.status, 401);

    const facultyRes = await fetch(`${address}/api/faculty/courses`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    assert.equal(facultyRes.status, 200);
    assert.equal(facultyRes.headers.get('cache-control'), 'no-store');
    assert.ok(facultyRes.headers.has('x-next-cursor'));
    const courses = await facultyRes.json();
    assert.equal(courses.length, 1);
    assert.equal(courses[0].course_code, 'CS101');
    assert.equal(courses[0].is_co_coordinator, true);

    const adminRes = await fetch(`${address}/api/faculty/courses`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminRes.status, 200);
  }

  let createdPracticalId;

  // 3. POST /api/faculty/practicals
  {
    const unauth = await fetch(`${address}/api/faculty/practicals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test' }),
    });
    assert.equal(unauth.status, 401);

    const studentRes = await fetch(`${address}/api/faculty/practicals`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test' }),
    });
    assert.equal(studentRes.status, 401);

    const badJson = await fetch(`${address}/api/faculty/practicals`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}`, 'Content-Type': 'application/json' },
      body: '{ not valid json',
    });
    assert.equal(badJson.status, 400);
    const badJsonBody = await badJson.json();
    assert.equal(badJsonBody.error, 'Invalid JSON payload');

    const invalidArray = await fetch(`${address}/api/faculty/practicals`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([1, 2, 3]),
    });
    assert.equal(invalidArray.status, 400);
    const invalidArrayBody = await invalidArray.json();
    assert.equal(invalidArrayBody.error, 'Expected a JSON object');

    const validPayload = {
      course_id: 1,
      title: 'Lab 1: Linked Lists',
      description: 'Implement a singly linked list in C/C++',
      start_time: new Date(Date.now() - 3600000).toISOString(),
      end_time: new Date(Date.now() + 86400000).toISOString(),
      test_cases: [
        {
          input: '5\n1 2 3 4 5',
          expected: '1 2 3 4 5',
          marks: 100,
          is_hidden: false,
        },
      ],
    };

    const createRes = await fetch(`${address}/api/faculty/practicals`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });
    assert.equal(createRes.status, 200);
    assert.equal(createRes.headers.get('cache-control'), 'no-store');
    const createData = await createRes.json();
    assert.equal(createData.success, true);
    assert.ok(createData.practical);
    assert.equal(createData.practical.title, 'Lab 1: Linked Lists');
    createdPracticalId = createData.practical.id;

    assert.ok(realtimeEvents.some(e => e.action === 'added' && e.payload.courseId === 1));
  }

  // 4. GET /api/faculty/practicals
  {
    const res = await fetch(`${address}/api/faculty/practicals`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.ok(res.headers.has('x-next-cursor'));
    const rows = await res.json();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, createdPracticalId);
    assert.equal(rows[0].course_name, 'Data Structures');
  }

  // 5. GET /api/faculty/practicals/:id
  {
    const notFound = await fetch(`${address}/api/faculty/practicals/999999`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    assert.equal(notFound.status, 404);

    const res = await fetch(`${address}/api/faculty/practicals/${createdPracticalId}`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const practical = await res.json();
    assert.equal(practical.id, createdPracticalId);
    assert.equal(practical.title, 'Lab 1: Linked Lists');
    assert.ok(Array.isArray(practical.test_cases));
    assert.equal(practical.test_cases.length, 1);
  }

  // 6. PUT /api/faculty/practicals/:id
  {
    const updatePayload = {
      title: 'Lab 1: Linked Lists (Updated)',
      description: 'Implement a singly linked list with reversal',
      start_time: new Date(Date.now() - 3600000).toISOString(),
      end_time: new Date(Date.now() + 86400000).toISOString(),
      test_cases: [
        {
          input: '5\n1 2 3 4 5',
          expected: '5 4 3 2 1',
          marks: 100,
          is_hidden: false,
        },
      ],
    };

    const updateRes = await fetch(`${address}/api/faculty/practicals/${createdPracticalId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${facultyToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(updatePayload),
    });
    assert.equal(updateRes.status, 200);
    const updateData = await updateRes.json();
    assert.equal(updateData.success, true);
    assert.equal(updateData.practical.title, 'Lab 1: Linked Lists (Updated)');

    assert.ok(realtimeEvents.some(e => e.action === 'updated' && e.payload.courseId === 1));
  }

  // 7. POST /api/faculty/practicals/:id/extra-time
  {
    const extraTimeRes = await fetch(`${address}/api/faculty/practicals/${createdPracticalId}/extra-time`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ extraMinutes: 60 }),
    });
    assert.equal(extraTimeRes.status, 200);
    const extraTimeData = await extraTimeRes.json();
    assert.equal(extraTimeData.success, true);
    assert.ok(extraTimeData.message.includes('Extra time granted successfully'));
    assert.ok(extraTimeData.practical);
  }

  // 8. GET /api/faculty/courses/:id/stats
  {
    const unauth = await fetch(`${address}/api/faculty/courses/1/stats`);
    assert.equal(unauth.status, 401);

    const res = await fetch(`${address}/api/faculty/courses/1/stats`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const report = await res.json();
    assert.ok(report.course);
    assert.equal(report.course.id, 1);
    assert.ok(Array.isArray(report.practicals));
    assert.ok(Array.isArray(report.students));
  }

  // 9. GET /api/faculty/practicals/:id/stats
  {
    const unauth = await fetch(`${address}/api/faculty/practicals/${createdPracticalId}/stats`);
    assert.equal(unauth.status, 401);

    const res = await fetch(`${address}/api/faculty/practicals/${createdPracticalId}/stats`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const stats = await res.json();
    assert.ok(stats.practical);
    assert.equal(stats.practical.id, createdPracticalId);
    assert.ok(stats.stats);
    assert.ok(Array.isArray(stats.students));
  }

  // 10. GET /api/student/practicals
  {
    const unauth = await fetch(`${address}/api/student/practicals`);
    assert.equal(unauth.status, 401);

    const facultyTry = await fetch(`${address}/api/student/practicals`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    assert.equal(facultyTry.status, 401);

    const res = await fetch(`${address}/api/student/practicals`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.ok(res.headers.has('x-next-cursor'));
    const rows = await res.json();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, createdPracticalId);
  }

  // 11. GET /api/student/practicals/:id
  {
    const unauth = await fetch(`${address}/api/student/practicals/${createdPracticalId}`);
    assert.equal(unauth.status, 401);

    const res = await fetch(`${address}/api/student/practicals/${createdPracticalId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const detail = await res.json();
    assert.equal(detail.id, `practical_${createdPracticalId}`);
    assert.equal(detail.dbId, createdPracticalId);
    assert.equal(detail.isPractical, true);
    assert.deepEqual(detail.testCases, []);
  }

  // 12. Method Not Allowed (405) and OPTIONS (204)
  {
    const batchOpt = await fetch(`${address}/api/faculty/batches`, { method: 'OPTIONS' });
    assert.equal(batchOpt.status, 204);
    assert.equal(batchOpt.headers.get('allow'), 'GET, HEAD, OPTIONS');

    const batchPost = await fetch(`${address}/api/faculty/batches`, { method: 'POST' });
    assert.equal(batchPost.status, 405);

    const practicalDetailOpt = await fetch(`${address}/api/faculty/practicals/${createdPracticalId}`, { method: 'OPTIONS' });
    assert.equal(practicalDetailOpt.status, 204);
    assert.equal(practicalDetailOpt.headers.get('allow'), 'DELETE, GET, HEAD, OPTIONS, PUT');

    const practicalDetailPost = await fetch(`${address}/api/faculty/practicals/${createdPracticalId}`, { method: 'POST' });
    assert.equal(practicalDetailPost.status, 405);
  }

  // 13. Gateway Routing Verification
  {
    // Proxied endpoints
    const gwBatches = await fetch(`${gatewayAddress}/api/faculty/batches`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    assert.equal(gwBatches.status, 200);

    const gwCourses = await fetch(`${gatewayAddress}/api/faculty/courses`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    assert.equal(gwCourses.status, 200);

    const gwCourseStats = await fetch(`${gatewayAddress}/api/faculty/courses/1/stats`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    assert.equal(gwCourseStats.status, 200);

    const gwPracticals = await fetch(`${gatewayAddress}/api/faculty/practicals`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    assert.equal(gwPracticals.status, 200);

    const gwPracticalDetail = await fetch(`${gatewayAddress}/api/faculty/practicals/${createdPracticalId}`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    assert.equal(gwPracticalDetail.status, 200);

    const gwPracticalStats = await fetch(`${gatewayAddress}/api/faculty/practicals/${createdPracticalId}/stats`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    assert.equal(gwPracticalStats.status, 200);

    const gwStudentPracticals = await fetch(`${gatewayAddress}/api/student/practicals`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(gwStudentPracticals.status, 200);

    const gwStudentPracticalDetail = await fetch(`${gatewayAddress}/api/student/practicals/${createdPracticalId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(gwStudentPracticalDetail.status, 200);

    // Unmigrated endpoints must NOT be proxied (must fall through to web / return 404 in test server)
    const unmigratedStats = await fetch(gatewayAddress + '/unmigrated-page');
    assert.equal(unmigratedStats.status, 404);
    assert.equal(await unmigratedStats.text(), 'web: not proxied');
  }

  // 14. DELETE /api/faculty/practicals/:id
  {
    const deleteRes = await fetch(`${address}/api/faculty/practicals/${createdPracticalId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    assert.equal(deleteRes.status, 200);
    const deleteData = await deleteRes.json();
    assert.equal(deleteData.success, true);
    assert.ok(deleteData.message.includes('Practical archived'));

    assert.ok(realtimeEvents.some(e => e.action === 'deleted' && e.payload.courseId === 1));

    // Subsequent detail fetch should show inactive / not list in active practicals
    const checkActive = await fetch(`${address}/api/student/practicals`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const activeList = await checkActive.json();
    assert.equal(activeList.length, 0);
  }
});
