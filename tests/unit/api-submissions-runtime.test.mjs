import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { PGlite } from '@electric-sql/pglite';
import { migrate } from '../../packages/database/src/migrations.js';
import { createApiGateway } from '../../infrastructure/gateway/proxy.mjs';

process.env.JWT_SECRET = 'submissions-runtime-test-secret-32-chars';

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
  new URL('../../packages/database/migrations/', import.meta.url)
);

await db.exec(`
  INSERT INTO users(id, name, email, password, role, extra_info, status)
  VALUES
    (1, 'Admin User', 'admin@test.com', 'x', 'admin', '{}', 'active'),
    (2, 'Faculty User', 'faculty@test.com', 'x', 'faculty', '{"department":"CS"}', 'active'),
    (3, 'Student A', 'student-a@test.com', 'x', 'student', '{"semester":1,"batch":"Batch A","division":"Div A"}', 'active'),
    (4, 'Student B', 'student-b@test.com', 'x', 'student', '{"semester":2,"batch":"Batch B","division":"Div B"}', 'active'),
    (5, 'Other Faculty', 'faculty-other@test.com', 'x', 'faculty', '{"department":"EE"}', 'active');
  SELECT setval('users_id_seq', (SELECT max(id) FROM users));

  INSERT INTO departments(id, name, institute_name)
  VALUES (1, 'Computer Science', 'Engineering Institute');
  SELECT setval('departments_id_seq', 1);

  INSERT INTO courses(id, name, course_code, semester)
  VALUES (1, 'Data Structures', 'CS101', 1);
  SELECT setval('courses_id_seq', 1);

  INSERT INTO course_faculty(course_id, faculty_id, is_co_coordinator)
  VALUES (1, 2, true);

  INSERT INTO practicals(id, course_id, faculty_id, batch_id, title, total_marks, status, created_at)
  VALUES (1, 1, 2, 'Batch A', 'Practical 1', 100, 'active', now());
  SELECT setval('practicals_id_seq', 1);

  INSERT INTO practical_test_cases(id, practical_id, input, expected, is_hidden, label, order_index)
  VALUES
    (1, 1, '1', '1', false, 'Case 1', 1),
    (2, 1, 'secret', 'secret', true, 'Hidden Case', 2);
  SELECT setval('practical_test_cases_id_seq', 2);
`);

async function seedSubmissionsAndWorkspaces() {
  await db.exec(`
    DELETE FROM student_workspaces;
    DELETE FROM practical_submission_cases;
    DELETE FROM practical_submissions;

    INSERT INTO practical_submissions(id, student_id, practical_id, language, code, status, raw_marks, normalized_marks, is_late, submitted_at)
    VALUES (1, 3, 1, 'python', convert_to('print("submitted code")', 'UTF8'), 'completed', 100, 100, false, now());
    SELECT setval('practical_submissions_id_seq', 1);

    INSERT INTO practical_submission_cases(id, submission_id, test_case_id, passed, marks_awarded)
    VALUES
      (1, 1, 1, true, 50),
      (2, 1, 2, true, 50);
    SELECT setval('practical_submission_cases_id_seq', 2);

    INSERT INTO student_workspaces(student_id, practical_id, language, latest_code, saved_at)
    VALUES (3, 1, 'python', convert_to('print("saved draft")', 'UTF8'), now());
  `);
}

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

const { generateToken, getUserFromRequest } = await import('../../packages/core/src/utils/auth.js');

mock.module('@coderank/core/security/active-actor', {
  namedExports: {
    authenticateRequest: async (request, { optional = false } = {}) => {
      const header = request?.headers?.get?.('authorization') || request?.headers?.authorization;
      if (optional && !header) return null;
      if (header === 'Bearer bad-token') throw { status: 401, message: 'Authentication required or session expired' };
      const actor = header && getUserFromRequest(request);
      if (!actor) throw { status: 401, message: 'Authentication required' };
      return actor;
    },
    authenticateToken: async token => {
      if (!token || token === 'bad-token') throw { status: 401, message: 'Authentication required' };
      const actor = getUserFromRequest({ headers: { authorization: `Bearer ${token}` } });
      if (!actor) throw { status: 401, message: 'Authentication required' };
      return actor;
    },
  },
});

let mockRateAllowed = true;
mock.module(new URL('../../apps/api/src/middleware/rate-limiter.js', import.meta.url).href, {
  namedExports: {
    checkRateLimit: async () => ({ allowed: mockRateAllowed }),
    closeRateLimiter: async () => {},
  },
});

const mockJobs = new Map();
let mockQueueShouldFail = false;
mock.module('@coderank/queue', {
  namedExports: {
    readExecutionWorkers: async () => ({ healthy: true, healthyWorkers: 2 }),
    createExecutionQueue: () => ({
      async getWaitingCount() { return 0; },
      async getActiveCount() { return 0; },
      async getCompletedCount() { return 0; },
      async getFailedCount() { return 0; },
      async getWorkers() { return [{ id: 'worker-1' }]; },
      async close() {},
      async disconnect() {},
      async add(type, data, opts) {
        if (mockQueueShouldFail) throw new Error('QUEUE_FULL');
        const id = opts?.jobId || `job-${mockJobs.size + 1}`;
        const job = {
          id,
          data,
          getState: async () => 'completed',
          returnvalue: { success: true },
        };
        mockJobs.set(id, job);
        return job;
      },
      async getJob(id) {
        return mockJobs.get(id) || null;
      },
    }),
  },
});

const { buildApp } = await import('../../apps/api/src/app.js');

test('Fastify submissions and workspaces HTTP contracts direct and via gateway', async t => {
  const app = buildApp();
  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  t.after(async () => {
    await app.close();
  });

  const proxy = createApiGateway({ origin: address });
  const gateway = http.createServer((req, res) => {
    if (!proxy(req, res)) {
      res.statusCode = 418;
      res.setHeader('Content-Type', 'text/plain');
      res.end('web-fallback');
    }
  });
  await new Promise(resolve => gateway.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    proxy.close();
    await new Promise(resolve => gateway.close(resolve));
  });
  const gatewayAddress = `http://127.0.0.1:${gateway.address().port}`;

  const adminToken = generateToken({ id: 1, role: 'admin' });
  const facultyToken = generateToken({ id: 2, role: 'faculty' });
  const studentAToken = generateToken({ id: 3, role: 'student' });
  const studentBToken = generateToken({ id: 4, role: 'student' });
  const otherFacultyToken = generateToken({ id: 5, role: 'faculty' });

  for (const base of [address, gatewayAddress]) {
    await seedSubmissionsAndWorkspaces();

    const isGw = base === gatewayAddress;
    const prefix = isGw ? '[Gateway]' : '[Direct API]';

    // 1. POST /api/submit
    await t.test(`${prefix} POST /api/submit denies anonymous submission with 401`, async () => {
      const res = await fetch(`${base}/api/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemId: 'two-sum', code: 'def solution(): pass', language: 'python' }),
      });
      assert.equal(res.status, 401);
      assert.equal(res.headers.get('cache-control'), 'no-store');
    });

    await t.test(`${prefix} POST /api/submit student can submit to practical`, async () => {
      const res = await fetch(`${base}/api/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAToken}`,
        },
        body: JSON.stringify({ problemId: 'practical_1', code: 'print("solution")', language: 'python' }),
      });
      assert.equal(res.status, 202);
      assert.equal(res.headers.get('cache-control'), 'no-store');
      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok(body.jobId);
    });

    await t.test(`${prefix} POST /api/submit denies faculty graded practical submission with 403`, async () => {
      const res = await fetch(`${base}/api/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${facultyToken}`,
        },
        body: JSON.stringify({ problemId: 'practical_1', code: 'print(1)', language: 'python' }),
      });
      assert.equal(res.status, 403);
    });

    // 2. POST /api/student/practicals/:id/submit
    await t.test(`${prefix} POST /api/student/practicals/:id/submit enqueues graded submission for enrolled student`, async () => {
      const res = await fetch(`${base}/api/student/practicals/1/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAToken}`,
        },
        body: JSON.stringify({ language: 'python', code: 'print("graded submission")' }),
      });
      assert.equal(res.status, 202);
      assert.equal(res.headers.get('cache-control'), 'no-store');
      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok(body.jobId);
    });

    await t.test(`${prefix} POST /api/student/practicals/:id/submit validates id and body`, async () => {
      const invalidId = await fetch(`${base}/api/student/practicals/abc/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAToken}`,
        },
        body: JSON.stringify({ language: 'python', code: 'x' }),
      });
      assert.equal(invalidId.status, 400);

      const invalidBody = await fetch(`${base}/api/student/practicals/1/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAToken}`,
        },
        body: 'invalid-json',
      });
      assert.equal(invalidBody.status, 400);
    });

    await t.test(`${prefix} POST /api/student/practicals/:id/submit rejects unenrolled student with 403`, async () => {
      const res = await fetch(`${base}/api/student/practicals/1/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentBToken}`,
        },
        body: JSON.stringify({ language: 'python', code: 'print("fail")' }),
      });
      assert.equal(res.status, 403);
    });

    // 3. Workspaces: GET /api/student/workspaces/load & POST /api/student/workspaces/save
    await t.test(`${prefix} GET & POST /api/student/workspaces load and save roundtrip`, async () => {
      const load = await fetch(`${base}/api/student/workspaces/load?practical_id=1&language=python`, {
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      assert.equal(load.status, 200);
      assert.equal(load.headers.get('cache-control'), 'no-store');
      const loadData = await load.json();
      assert.equal(loadData.latest_code, 'print("saved draft")');

      const save = await fetch(`${base}/api/student/workspaces/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentAToken}`,
        },
        body: JSON.stringify({ practical_id: 1, language: 'python', code: 'print("updated draft")' }),
      });
      assert.equal(save.status, 200);
      assert.equal(save.headers.get('cache-control'), 'no-store');
      const saveData = await save.json();
      assert.equal(saveData.success, true);

      const reload = await fetch(`${base}/api/student/workspaces/load?practical_id=1&language=python`, {
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      const reloadData = await reload.json();
      assert.equal(reloadData.latest_code, 'print("updated draft")');
    });

    // 4. GET /api/student/submissions
    await t.test(`${prefix} GET /api/student/submissions returns history and X-Next-Cursor`, async () => {
      const res = await fetch(`${base}/api/student/submissions?limit=10`, {
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('cache-control'), 'no-store');
      assert.ok(res.headers.has('x-next-cursor'));
      const rows = await res.json();
      assert.ok(Array.isArray(rows));
      assert.ok(rows.length >= 1);
    });

    // 5. GET /api/student/practicals/:id/submissions
    await t.test(`${prefix} GET /api/student/practicals/:id/submissions returns practical history`, async () => {
      const res = await fetch(`${base}/api/student/practicals/1/submissions`, {
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('cache-control'), 'no-store');
      const rows = await res.json();
      assert.ok(Array.isArray(rows));
      assert.ok(rows.length >= 1);
    });

    // 6. GET /api/faculty/practicals/:id/submissions
    await t.test(`${prefix} GET /api/faculty/practicals/:id/submissions returns faculty view for assigned practical`, async () => {
      const res = await fetch(`${base}/api/faculty/practicals/1/submissions`, {
        headers: { Authorization: `Bearer ${facultyToken}` },
      });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('cache-control'), 'no-store');
      assert.ok(res.headers.has('x-next-cursor'));
      const rows = await res.json();
      assert.ok(Array.isArray(rows));
      assert.ok(rows.length >= 1);
      assert.equal(rows[0].student_email, 'student-a@test.com');
    });

    await t.test(`${prefix} GET /api/faculty/practicals/:id/submissions denies unassigned faculty with 404`, async () => {
      const res = await fetch(`${base}/api/faculty/practicals/1/submissions`, {
        headers: { Authorization: `Bearer ${otherFacultyToken}` },
      });
      assert.equal(res.status, 404);
    });

    // 7. GET /api/faculty/submissions/:id
    await t.test(`${prefix} GET /api/faculty/submissions/:id decodes binary code and includes test cases`, async () => {
      const res = await fetch(`${base}/api/faculty/submissions/1`, {
        headers: { Authorization: `Bearer ${facultyToken}` },
      });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('cache-control'), 'no-store');
      const sub = await res.json();
      assert.equal(sub.id, 1);
      assert.equal(sub.code, 'print("submitted code")');
      assert.ok(Array.isArray(sub.cases));
      assert.equal(sub.cases.length, 2);
    });

    // 8. DELETE /api/faculty/submissions/:id
    await t.test(`${prefix} DELETE /api/faculty/submissions/:id allows faculty reset`, async () => {
      const res = await fetch(`${base}/api/faculty/submissions/1`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${facultyToken}` },
      });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('cache-control'), 'no-store');
    });

    // 9. HTTP 405 Method Not Allowed & OPTIONS on all endpoints
    await t.test(`${prefix} Method Not Allowed and OPTIONS contracts`, async () => {
      const methodCases = [
        ['/api/submit', ['GET', 'DELETE', 'PUT']],
        ['/api/student/practicals/1/submit', ['GET', 'DELETE', 'PUT']],
        ['/api/student/submissions', ['POST', 'DELETE', 'PUT']],
        ['/api/student/practicals/1/submissions', ['POST', 'DELETE', 'PUT']],
        ['/api/faculty/practicals/1/submissions', ['POST', 'DELETE', 'PUT']],
        ['/api/faculty/submissions/1', ['POST', 'PUT', 'PATCH']],
        ['/api/student/workspaces/load', ['POST', 'DELETE', 'PUT']],
        ['/api/student/workspaces/save', ['GET', 'DELETE', 'PUT']],
      ];

      for (const [url, invalidMethods] of methodCases) {
        for (const method of invalidMethods) {
          const res = await fetch(`${base}${url}`, { method });
          assert.equal(res.status, 405, `${method} ${url} must return 405`);
          assert.equal(res.headers.get('cache-control'), 'no-store');
          assert.ok(res.headers.get('allow'), `${method} ${url} missing Allow header`);
        }

        const opt = await fetch(`${base}${url}`, { method: 'OPTIONS' });
        assert.equal(opt.status, 204, `OPTIONS ${url} must return 204`);
        assert.ok(opt.headers.get('allow'), `OPTIONS ${url} missing Allow header`);
      }
    });
  }

  // Unmigrated paths bypass gateway to web fallback (418)
  await t.test('Same-origin gateway bypasses unmigrated paths to web fallback (418)', async () => {
    const unmigrated = await fetch(`${gatewayAddress}/unmigrated-page`);
    assert.equal(unmigrated.status, 418);
    assert.equal(await unmigrated.text(), 'web-fallback');
  });
});
