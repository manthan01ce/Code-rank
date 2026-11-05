import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { PGlite } from '@electric-sql/pglite';
import { migrate } from '../packages/database/src/migrations.js';
import { createApiGateway } from '../infrastructure/gateway/proxy.mjs';

process.env.JWT_SECRET = 'courses-runtime-test-secret-32-chars';

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
  INSERT INTO users(id, name, email, password, role, extra_info)
  VALUES
    (1, 'Admin User', 'admin@test.com', 'x', 'admin', '{}'),
    (2, 'Faculty User', 'faculty@test.com', 'x', 'faculty', '{"department":"CS"}'),
    (3, 'Student User', 'student@test.com', 'x', 'student', '{"semester":1}');
  SELECT setval('users_id_seq', (SELECT max(id) FROM users));
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

test('Fastify courses, departments, and mapping HTTP contracts direct and via gateway', async t => {
  const app = buildApp();
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

  const adminHeaders = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
  const facultyHeaders = { Authorization: `Bearer ${facultyToken}`, 'Content-Type': 'application/json' };
  const studentHeaders = { Authorization: `Bearer ${studentToken}`, 'Content-Type': 'application/json' };

  for (const base of [address, gatewayAddress]) {
    // 1. Auth and Role Rejections
    const unauthCourses = await fetch(`${base}/api/courses`);
    assert.equal(unauthCourses.status, 401);

    const studentCreateCourse = await fetch(`${base}/api/courses`, {
      method: 'POST',
      headers: studentHeaders,
      body: JSON.stringify({ name: 'Student Course', course_code: 'SC1', semester: 1 }),
    });
    assert.equal(studentCreateCourse.status, 401);

    const facultyCreateDept = await fetch(`${base}/api/departments`, {
      method: 'POST',
      headers: facultyHeaders,
      body: JSON.stringify({ name: 'Faculty Dept', institute_name: 'Inst' }),
    });
    assert.equal(facultyCreateDept.status, 401);

    const studentListDept = await fetch(`${base}/api/departments`, { headers: studentHeaders });
    assert.equal(studentListDept.status, 401);

    const facultyGetMapping = await fetch(`${base}/api/mapping`, { headers: facultyHeaders });
    assert.equal(facultyGetMapping.status, 401);

    const studentPostMapping = await fetch(`${base}/api/mapping`, {
      method: 'POST',
      headers: studentHeaders,
      body: JSON.stringify({ course_id: 1, faculty_ids: [2] }),
    });
    assert.equal(studentPostMapping.status, 401);

    // 2. Payload validation
    const malformed = await fetch(`${base}/api/courses`, {
      method: 'POST',
      headers: adminHeaders,
      body: '{ invalid',
    });
    assert.equal(malformed.status, 400);

    const invalidSem = await fetch(`${base}/api/courses`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ name: 'Test Course', course_code: 'TC_SEM', semester: 0 }),
    });
    assert.equal(invalidSem.status, 400);

    // 3. Method Not Allowed & OPTIONS
    const patchRes = await fetch(`${base}/api/courses`, { method: 'PATCH', headers: adminHeaders });
    assert.equal(patchRes.status, 405);

    const getByIdRes = await fetch(`${base}/api/courses/1`, { headers: adminHeaders });
    assert.equal(getByIdRes.status, 405);

    const optionsRes = await fetch(`${base}/api/courses`, { method: 'OPTIONS' });
    assert.equal(optionsRes.status, 204);
    assert.ok(optionsRes.headers.get('allow').includes('GET'));
    assert.ok(optionsRes.headers.get('allow').includes('POST'));

    const optionsIdRes = await fetch(`${base}/api/courses/1`, { method: 'OPTIONS' });
    assert.equal(optionsIdRes.status, 204);
    assert.ok(optionsIdRes.headers.get('allow').includes('DELETE'));
    assert.ok(optionsIdRes.headers.get('allow').includes('PUT'));
  }

  // 4. Course CRUD Lifecycle
  const createCourseRes = await fetch(`${address}/api/courses`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ name: 'Data Structures', course_code: 'CS201', semester: 3 }),
  });
  assert.equal(createCourseRes.status, 200);
  const createdCourse = await createCourseRes.json();
  assert.equal(createdCourse.course_code, 'CS201');
  assert.equal(createdCourse.name, 'Data Structures');
  assert.equal(createdCourse.semester, 3);
  const courseId = createdCourse.id;

  // Duplicate course code fails with 409
  const dupCourseRes = await fetch(`${gatewayAddress}/api/courses`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ name: 'Another Data Structures', course_code: 'CS201', semester: 3 }),
  });
  assert.equal(dupCourseRes.status, 409);

  // List courses via gateway
  const listCoursesRes = await fetch(`${gatewayAddress}/api/courses`, { headers: studentHeaders });
  assert.equal(listCoursesRes.status, 200);
  assert.equal(listCoursesRes.headers.get('cache-control'), 'no-store');
  const coursesList = await listCoursesRes.json();
  assert.ok(Array.isArray(coursesList));
  assert.ok(coursesList.some(c => c.course_code === 'CS201'));

  // Filter courses by semester
  const semCoursesRes = await fetch(`${address}/api/courses?semester=3`, { headers: adminHeaders });
  const semCourses = await semCoursesRes.json();
  assert.ok(semCourses.every(c => c.semester === 3));

  // Update course
  const updateCourseRes = await fetch(`${gatewayAddress}/api/courses/${courseId}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({ name: 'Advanced Data Structures', course_code: 'CS201', semester: 3 }),
  });
  assert.equal(updateCourseRes.status, 200);
  const updateBody = await updateCourseRes.json();
  assert.equal(updateBody.success, true);
  assert.equal(updateBody.course.name, 'Advanced Data Structures');

  // Update non-existent course returns 404
  const updateMissing = await fetch(`${address}/api/courses/99999`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({ name: 'Ghost', course_code: 'GHOST', semester: 1 }),
  });
  assert.equal(updateMissing.status, 404);

  // 5. Department CRUD Lifecycle
  const createDeptRes = await fetch(`${address}/api/departments`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ name: 'Computer Science', institute_name: 'Engineering College' }),
  });
  assert.equal(createDeptRes.status, 200);
  const createdDept = await createDeptRes.json();
  assert.equal(createdDept.name, 'Computer Science');
  const deptId = createdDept.id;

  // Duplicate department returns 409
  const dupDeptRes = await fetch(`${gatewayAddress}/api/departments`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ name: 'Computer Science', institute_name: 'Another Institute' }),
  });
  assert.equal(dupDeptRes.status, 409);

  // List departments via gateway
  const listDeptsRes = await fetch(`${gatewayAddress}/api/departments`, { headers: adminHeaders });
  assert.equal(listDeptsRes.status, 200);
  assert.equal(listDeptsRes.headers.get('cache-control'), 'no-store');
  const deptsList = await listDeptsRes.json();
  assert.ok(Array.isArray(deptsList));
  assert.ok(deptsList.some(d => d.id === deptId));

  // Update department
  const updateDeptRes = await fetch(`${address}/api/departments/${deptId}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({ name: 'Computer Science and Engineering', institute_name: 'Engineering College' }),
  });
  assert.equal(updateDeptRes.status, 200);
  const updateDeptBody = await updateDeptRes.json();
  assert.equal(updateDeptBody.success, true);
  assert.equal(updateDeptBody.department.name, 'Computer Science and Engineering');

  // 6. Mapping Lifecycle
  // Initial mapping lookup
  const initialMapRes = await fetch(`${gatewayAddress}/api/mapping`, { headers: adminHeaders });
  assert.equal(initialMapRes.status, 200);

  // Replace mapping
  const setMappingRes = await fetch(`${address}/api/mapping`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ course_id: courseId, faculty_ids: [2], co_coordinator_id: 2 }),
  });
  assert.equal(setMappingRes.status, 200);
  assert.deepEqual(await setMappingRes.json(), { success: true });

  // Verify mapping updated
  const updatedMapRes = await fetch(`${gatewayAddress}/api/mapping`, { headers: adminHeaders });
  assert.equal(updatedMapRes.status, 200);
  const mappingData = await updatedMapRes.json();
  assert.ok(mappingData[courseId]);
  assert.equal(mappingData[courseId][0].id, 2);
  assert.equal(mappingData[courseId][0].is_co_coordinator, true);

  // Duplicate faculty IDs rejected
  const dupFacultyRes = await fetch(`${address}/api/mapping`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ course_id: courseId, faculty_ids: [2, 2] }),
  });
  assert.equal(dupFacultyRes.status, 400);

  // Delete course
  const deleteCourseRes = await fetch(`${gatewayAddress}/api/courses/${courseId}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });
  assert.equal(deleteCourseRes.status, 200);
  assert.deepEqual(await deleteCourseRes.json(), { success: true });

  // Delete department
  const deleteDeptRes = await fetch(`${address}/api/departments/${deptId}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });
  assert.equal(deleteDeptRes.status, 200);
  assert.deepEqual(await deleteDeptRes.json(), { success: true });
});
