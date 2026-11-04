import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { PGlite } from '@electric-sql/pglite';
import { migrate } from '../packages/database/src/migrations.js';
import { createApiGateway } from '../apps/web/src/lib/api-gateway.js';
import { ALLOWED_LANGUAGES, GUEST_COOKIE } from '../packages/core/src/security/execution.js';

process.env.JWT_SECRET = 'execution-runtime-test-secret-32-chars';

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
    (3, 'Student A', 'student-a@test.com', 'x', 'student', '{"semester":1,"batch":"Batch A","division":"Div A"}', 'active'),
    (4, 'Student B', 'student-b@test.com', 'x', 'student', '{"semester":2,"batch":"Batch B","division":"Div B"}', 'active');
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
mock.module(new URL('../apps/api/src/middleware/rate-limiter.js', import.meta.url).href, {
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
          returnvalue: {
            success: true,
            cases: [
              { id: 1, passed: true, input: '3 5', expected: '8', stdout: '8' },
              { id: 2, passed: true, is_hidden: true, hidden: true, input: 'SECRET_INPUT', expected: 'SECRET_EXPECTED' },
            ],
          },
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

const { buildApp } = await import('../apps/api/src/app.js');

test('Fastify execution and job polling runtime contracts direct and via gateway', async t => {
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
  const gatewayAddress = `http://127.0.0.1:${gateway.address().port}`;
  t.after(async () => {
    await new Promise(resolve => gateway.close(resolve));
  });

  const targets = [
    { name: 'Direct API', base: address },
    { name: 'Gateway', base: gatewayAddress },
  ];

  const adminToken = generateToken({ id: 1, role: 'admin' });
  const studentAToken = generateToken({ id: 3, role: 'student' });
  const studentBToken = generateToken({ id: 4, role: 'student' });

  for (const { name, base } of targets) {
    await t.test(`[${name}] GET /api/execute returns queue health, languages and Cache-Control: no-store`, async () => {
      const res = await fetch(`${base}/api/execute`);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('cache-control'), 'no-store');
      const data = await res.json();
      assert.equal(data.status, 'healthy');
      assert.ok(Array.isArray(data.languages));
      assert.ok(data.languages.includes('python'));
      assert.ok(data.languages.includes('cpp'));
    });

    await t.test(`[${name}] GET /api/practice-run returns queue stats and Cache-Control: no-store`, async () => {
      const res = await fetch(`${base}/api/practice-run`);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('cache-control'), 'no-store');
      const data = await res.json();
      assert.equal(data.status, 'healthy');
      assert.ok(data.queue);
    });

    await t.test(`[${name}] Anonymous execution creates guest session cookie and enqueues playground job`, async () => {
      const res = await fetch(`${base}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'python', code: 'print(42)', input: '' }),
      });
      assert.equal(res.status, 202);
      assert.equal(res.headers.get('cache-control'), 'no-store');
      const setCookie = res.headers.get('set-cookie');
      assert.ok(setCookie, 'Guest cookie must be set');
      assert.match(setCookie, new RegExp(`${GUEST_COOKIE}=[a-f0-9]{64}`));
      assert.match(setCookie, /HttpOnly/i);
      assert.match(setCookie, /SameSite=Lax/i);

      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.status, 'queued');
      assert.ok(body.jobId);

      // Extract cookie value for subsequent polling
      const cookieVal = setCookie.split(';')[0];

      // Polling with correct guest cookie succeeds
      const pollRes = await fetch(`${base}/api/jobs/${body.jobId}`, {
        headers: { cookie: cookieVal },
      });
      assert.equal(pollRes.status, 200);
      assert.equal(pollRes.headers.get('cache-control'), 'no-store');
      const jobData = await pollRes.json();
      assert.equal(jobData.jobId, body.jobId);
      assert.equal(jobData.status, 'completed');

      // Polling without cookie fails with 403
      const unauthPoll = await fetch(`${base}/api/jobs/${body.jobId}`);
      assert.equal(unauthPoll.status, 403);
      assert.equal((await unauthPoll.json()).error, 'Job access denied');

      // Admin can poll any guest job
      const adminPoll = await fetch(`${base}/api/jobs/${body.jobId}`, {
        headers: { authorization: `Bearer ${adminToken}` },
      });
      assert.equal(adminPoll.status, 200);
    });

    await t.test(`[${name}] Language aliases enqueue practice jobs and sanitize hidden tests`, async () => {
      for (const lang of ['c', 'cpp', 'java', 'javascript', 'python']) {
        const res = await fetch(`${base}/api/${lang}-run`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            authorization: `Bearer ${studentAToken}`,
          },
          body: JSON.stringify({ problemId: 1, code: 'class Solution: pass' }),
        });
        assert.equal(res.status, 202, `${lang}-run must succeed with 202`);
        const { jobId } = await res.json();

        // Poll job and check that hidden test details are sanitized
        const poll = await fetch(`${base}/api/jobs/${jobId}`, {
          headers: { authorization: `Bearer ${studentAToken}` },
        });
        assert.equal(poll.status, 200);
        const job = await poll.json();
        const hiddenCase = job.result.cases.find(c => c.is_hidden || c.hidden);
        assert.ok(hiddenCase);
        assert.equal(hiddenCase.input, undefined, 'Hidden case input must not leak');
        assert.equal(hiddenCase.expected, undefined, 'Hidden case expected must not leak');
        assert.equal(hiddenCase.passed, true);
      }
    });

    await t.test(`[${name}] Practical execution obeys batch/semester authorization`, async () => {
      // Anonymous cannot execute practical
      const anonRes = await fetch(`${base}/api/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemId: 'practical_1', code: 'print("test")' }),
      });
      assert.equal(anonRes.status, 401);

      // Student B (Batch B, Semester 2) is not assigned to Practical 1 (Batch A, Semester 1)
      const deniedRes = await fetch(`${base}/api/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${studentBToken}`,
        },
        body: JSON.stringify({ problemId: 'practical_1', code: 'print("test")' }),
      });
      assert.equal(deniedRes.status, 403);

      // Student A (Batch A, Semester 1) is authorized
      const allowedRes = await fetch(`${base}/api/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${studentAToken}`,
        },
        body: JSON.stringify({ problemId: 'practical_1', code: 'print("test")' }),
      });
      assert.equal(allowedRes.status, 202);
      const { jobId } = await allowedRes.json();
      assert.ok(jobId);

      // Student B cannot poll Student A's job
      const crossPoll = await fetch(`${base}/api/jobs/${jobId}`, {
        headers: { authorization: `Bearer ${studentBToken}` },
      });
      assert.equal(crossPoll.status, 403);
    });

    await t.test(`[${name}] Validation errors return 400 or 413`, async () => {
      // Malformed JSON
      const malformed = await fetch(`${base}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      });
      assert.equal(malformed.status, 400);
      assert.equal((await malformed.json()).error, 'Invalid JSON payload');

      // Unsupported language
      const badLang = await fetch(`${base}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'cobol', code: 'print(1)' }),
      });
      assert.equal(badLang.status, 400);
      assert.equal((await badLang.json()).error, 'Unsupported language');

      // Empty code
      const emptyCode = await fetch(`${base}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'python', code: '' }),
      });
      assert.equal(emptyCode.status, 400);

      // Oversized code (> 128 KiB)
      const oversized = await fetch(`${base}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'python', code: 'x'.repeat(131073) }),
      });
      assert.equal(oversized.status, 413);

      // Missing problemId lookup
      const missingProblem = await fetch(`${base}/api/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemId: 'nonexistent-problem-id', code: 'print(1)' }),
      });
      assert.equal(missingProblem.status, 404);
    });

    await t.test(`[${name}] Rate limit 429 and Queue full 503 error responses`, async () => {
      mockRateAllowed = false;
      const rateLimited = await fetch(`${base}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'python', code: 'print(1)' }),
      });
      assert.equal(rateLimited.status, 429);
      assert.equal(rateLimited.headers.get('cache-control'), 'no-store');
      assert.equal((await rateLimited.json()).error, 'Too many requests');
      mockRateAllowed = true;

      mockQueueShouldFail = true;
      const queueFull = await fetch(`${base}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'python', code: 'print(1)' }),
      });
      assert.equal(queueFull.status, 503);
      assert.equal(queueFull.headers.get('cache-control'), 'no-store');
      assert.equal(queueFull.headers.get('retry-after'), '5');
      mockQueueShouldFail = false;
    });

    await t.test(`[${name}] Unsupported HTTP methods return HTTP 405 Method Not Allowed`, async () => {
      // /api/run only allows POST
      for (const method of ['DELETE', 'GET', 'PUT', 'PATCH']) {
        const res = await fetch(`${base}/api/run`, { method });
        assert.equal(res.status, 405, `${method} /api/run must return 405`);
        assert.equal(res.headers.get('cache-control'), 'no-store');
        assert.match(res.headers.get('allow') || '', /POST/);
      }

      // /api/execute allows GET, HEAD, POST
      for (const method of ['DELETE', 'PUT', 'PATCH']) {
        const res = await fetch(`${base}/api/execute`, { method });
        assert.equal(res.status, 405, `${method} /api/execute must return 405`);
        assert.equal(res.headers.get('cache-control'), 'no-store');
        assert.match(res.headers.get('allow') || '', /GET/);
        assert.match(res.headers.get('allow') || '', /POST/);
      }

      // /api/jobs/:jobId allows GET, HEAD
      for (const method of ['DELETE', 'POST', 'PUT', 'PATCH']) {
        const res = await fetch(`${base}/api/jobs/job-1`, { method });
        assert.equal(res.status, 405, `${method} /api/jobs/:jobId must return 405`);
        assert.equal(res.headers.get('cache-control'), 'no-store');
        assert.match(res.headers.get('allow') || '', /GET/);
      }

      // OPTIONS returns 204
      const opt = await fetch(`${base}/api/execute`, { method: 'OPTIONS' });
      assert.equal(opt.status, 204);
      assert.match(opt.headers.get('allow') || '', /GET/);
    });
  }

  await t.test('Same-origin gateway bypasses unmigrated paths to web fallback (418)', async () => {
    const unmigrated = await fetch(`${gatewayAddress}/api/stats`, { method: 'POST' });
    assert.equal(unmigrated.status, 418);
    assert.equal(await unmigrated.text(), 'web-fallback');
  });
});
