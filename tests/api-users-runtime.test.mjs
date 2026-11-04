import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { registerHooks } from 'node:module';
import { createApiGateway } from '../apps/web/src/lib/api-gateway.js';

process.env.JWT_SECRET = 'users-runtime-test-secret';

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('@/')) {
      return next(
        new URL(`../apps/web/src/${specifier.slice(2)}.js`, import.meta.url).href,
        context,
      );
    }
    if (specifier === 'next/server') return next('next/server.js', context);
    return next(specifier, context);
  },
});

const mockUsers = [
  { id: 10, name: 'Student 10', email: 's10@test.io', role: 'student', status: 'active', extra_info: { division: 'CE1', roll_number: '25CE010' } },
  { id: 9, name: 'Student 9', email: 's9@test.io', role: 'student', status: 'active', extra_info: { division: 'CE1', roll_number: '25CE009' } },
];

let createdUsers = [];
let deactivatedIds = [];
let updatedUsers = [];
let changedPasswords = [];

mock.module('@coderank/core/services/UserManagementService', {
  namedExports: {
    UserManagementService: {
      admin: (user) => {
        if (!user || user.role !== 'admin') throw { status: 401, message: 'Unauthorized' };
      },
      mutate: async (admin, id, action, body) => {
        if (!admin || admin.role !== 'admin') throw { status: 401, message: 'Unauthorized' };
        if (action === 'create') {
          if (!body?.name || !body?.email || !body?.role) throw { status: 400, message: 'Name, email and role are required' };
          if (body.email === 'duplicate@test.io') throw { status: 409, message: 'Email already exists' };
          if (body.role === 'student' && !body.extra_info?.division) throw { status: 400, message: 'Student division is required' };
          if (body.extra_info?.division === 'BAD') throw { status: 400, message: 'Invalid student division' };
          const u = { id: 100 + createdUsers.length, ...body };
          createdUsers.push(u);
          return { user: u, rawPassword: 'generated-raw-password-123' };
        }
        if (action === 'update') {
          if (id === 999 || id === '999') throw { status: 404, message: 'User not found or protected' };
          updatedUsers.push({ id, ...body });
          return { user: { id: Number(id), ...body } };
        }
        if (action === 'deactivate') {
          if (id === 999 || id === '999') throw { status: 404, message: 'User not found or protected' };
          deactivatedIds.push(Number(id));
          return { user: { id: Number(id), status: 'inactive' } };
        }
        throw Error('unsupported action');
      },
    },
  },
});

mock.module('@coderank/core/services/UserService', {
  namedExports: {
    UserService: {
      validateDivision: (division) => {
        if (!division || typeof division !== 'string') return { valid: false, error: 'Division is compulsory' };
        const trimmed = division.trim();
        const alpha = (trimmed.match(/[a-zA-Z]/g) || []).length;
        const digits = (trimmed.match(/[0-9]/g) || []).length;
        if (alpha < 2 || digits < 1) return { valid: false, error: 'Division must contain >=2 letters and >=1 digit' };
        return { valid: true };
      },
      changePassword: async (admin, { currentPassword, newPassword } = {}) => {
        if (!admin || admin.role !== 'admin') throw { status: 401, message: 'Unauthorized' };
        if (!currentPassword || !newPassword || newPassword.length < 8) {
          throw { status: 400, message: 'Current password is required; new password must be at least 8 characters' };
        }
        if (currentPassword === 'wrong') throw { status: 400, message: 'Invalid current password' };
        changedPasswords.push({ adminId: admin.id, newPassword });
        return { success: true, message: 'Password updated successfully', token: 'new-rotated-token' };
      },
      listUsers: async ({ role, cursor, limit = 100 } = {}) => {
        const lim = Number(limit);
        if (!Number.isSafeInteger(lim) || lim < 1 || lim > 200) throw { status: 400, message: 'Invalid pagination' };
        if (cursor !== null && (!Number.isSafeInteger(Number(cursor)) || Number(cursor) < 1)) {
          throw { status: 400, message: 'Invalid pagination' };
        }
        return mockUsers.filter(u => !role || u.role === role);
      },
      createUser: async (admin, body, options) => {
        const { UserManagementService } = await import('@coderank/core/services/UserManagementService');
        return UserManagementService.mutate(admin, null, 'create', body, options);
      },
      updateUser: async (admin, body) => {
        const { UserManagementService } = await import('@coderank/core/services/UserManagementService');
        return (await UserManagementService.mutate(admin, body.id, 'update', body)).user;
      },
      deleteUser: async (admin, id) => {
        const { UserManagementService } = await import('@coderank/core/services/UserManagementService');
        await UserManagementService.mutate(admin, id, 'deactivate');
        return { success: true };
      },
      bulkUploadUsers: async (admin, usersList, role) => {
        if (!admin || admin.role !== 'admin') throw { status: 401, message: 'Unauthorized' };
        if (!Array.isArray(usersList) || usersList.length > 500) throw { status: 400, message: 'Maximum 500 users per upload' };
        const users = [];
        const errors = [];
        for (const [index, u] of usersList.entries()) {
          if (u.email === 'duplicate@test.io') {
            errors.push({ row: index + 1, email: u.email, error: 'Email already exists' });
          } else {
            const created = { id: 200 + index, ...u, role };
            users.push({ ...created, rawPassword: 'raw-password' });
          }
        }
        return { success: true, createdCount: users.length, users, errors };
      },
    },
  },
});

const { generateToken, getUserFromRequest } = await import('../packages/core/src/utils/auth.js');

mock.module('@coderank/core/security/active-actor', {
  namedExports: {
    authenticateRequest: async (request, { optional = false } = {}) => {
      const headers = request?.headers;
      const header = typeof headers?.get === 'function' ? headers.get('authorization') : headers?.authorization;
      if (optional && !header) return null;
      const actor = header && getUserFromRequest(request);
      if (!actor) throw { status: 401, message: 'Authentication required' };
      return actor;
    },
    authenticateToken: async () => ({ id: 1, role: 'admin' }),
  },
});

const { buildApp } = await import('../apps/api/src/app.js');

test('Fastify API and same-origin gateway user management runtime contracts', async (t) => {
  const apiApp = buildApp();
  const apiAddress = await apiApp.listen({ host: '127.0.0.1', port: 0 });

  const proxy = createApiGateway({ origin: apiAddress });
  const gateway = http.createServer((req, res) => {
    if (!proxy(req, res)) {
      res.writeHead(418, { 'Content-Type': 'text/plain' });
      res.end('web fallback');
    }
  });
  await new Promise(resolve => gateway.listen(0, '127.0.0.1', resolve));
  const gatewayAddress = `http://127.0.0.1:${gateway.address().port}`;

  t.after(async () => {
    await apiApp.close();
    await new Promise(resolve => gateway.close(resolve));
  });

  const adminToken = generateToken({ id: 1, name: 'Admin', email: 'admin@test.io', role: 'admin' });
  const studentToken = generateToken({ id: 2, name: 'Student', email: 'student@test.io', role: 'student' });
  const facultyToken = generateToken({ id: 3, name: 'Faculty', email: 'faculty@test.io', role: 'faculty' });

  for (const base of [apiAddress, gatewayAddress]) {
    const isGateway = base === gatewayAddress;
    const label = isGateway ? '[Gateway]' : '[Direct API]';

    await t.test(`${label} Anonymous and non-admin requests are denied across all endpoints`, async () => {
      const endpoints = [
        { path: '/api/users', method: 'GET' },
        { path: '/api/users/10', method: 'PUT' },
        { path: '/api/admin/password', method: 'POST' },
        { path: '/api/admin/bulk-upload', method: 'POST' },
        { path: '/api/users/bulk', method: 'POST' },
      ];
      for (const { path, method } of endpoints) {
        const anon = await fetch(`${base}${path}`, { method });
        assert.equal(anon.status, 401, `${label} anonymous ${method} ${path} must return 401`);
        assert.equal(anon.headers.get('cache-control'), 'no-store');

        const student = await fetch(`${base}${path}`, {
          method,
          headers: { Authorization: `Bearer ${studentToken}` },
        });
        assert.equal(student.status, 401, `${label} student access to ${method} ${path} must return 401`);

        const faculty = await fetch(`${base}${path}`, {
          method,
          headers: { Authorization: `Bearer ${facultyToken}` },
        });
        assert.equal(faculty.status, 401, `${label} faculty access to ${method} ${path} must return 401`);
      }
    });

    await t.test(`${label} GET /api/users returns keyset pagination, filters and Cache-Control: no-store`, async () => {
      const res = await fetch(`${base}/api/users?limit=10`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('cache-control'), 'no-store');
      assert.ok(res.headers.has('x-next-cursor'));
      const data = await res.json();
      assert.ok(Array.isArray(data));
      assert.equal(data.length, 2);

      const invalidLimit = await fetch(`${base}/api/users?limit=300`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(invalidLimit.status, 400);
      assert.deepEqual(await invalidLimit.json(), { error: 'Invalid pagination' });

      const invalidCursor = await fetch(`${base}/api/users?cursor=abc`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(invalidCursor.status, 400);
      assert.deepEqual(await invalidCursor.json(), { error: 'Invalid pagination' });
    });

    await t.test(`${label} POST /api/users creates user with Server-Timing, Cache-Control and rawPassword`, async () => {
      const res = await fetch(`${base}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Synthetic User',
          email: 'synthetic@test.io',
          role: 'student',
          extra_info: { division: 'CE1' },
        }),
      });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('cache-control'), 'no-store');
      assert.ok(res.headers.has('server-timing'));
      const body = await res.json();
      assert.equal(body.user.name, 'Synthetic User');
      assert.equal(body.user.email, 'synthetic@test.io');
      assert.ok(body.rawPassword);

      const dup = await fetch(`${base}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Duplicate User',
          email: 'duplicate@test.io',
          role: 'student',
          extra_info: { division: 'CE1' },
        }),
      });
      assert.equal(dup.status, 409);
      assert.deepEqual(await dup.json(), { error: 'Email already exists' });

      const invalidDiv = await fetch(`${base}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Bad Div',
          email: 'baddiv@test.io',
          role: 'student',
          extra_info: { division: 'BAD' },
        }),
      });
      assert.equal(invalidDiv.status, 400);
      assert.deepEqual(await invalidDiv.json(), { error: 'Invalid student division' });
    });

    await t.test(`${label} PUT and DELETE on /api/users and /api/users/:id`, async () => {
      const putUsers = await fetch(`${base}/api/users`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ id: 10, name: 'Updated Via Put Users' }),
      });
      assert.equal(putUsers.status, 200);
      const putUsersData = await putUsers.json();
      assert.equal(putUsersData.name, 'Updated Via Put Users');

      const delUsers = await fetch(`${base}/api/users?id=10`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(delUsers.status, 200);
      assert.deepEqual(await delUsers.json(), { success: true });

      const putId = await fetch(`${base}/api/users/10`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ name: 'Updated Via Param' }),
      });
      assert.equal(putId.status, 200);
      const putIdData = await putId.json();
      assert.equal(putIdData.success, true);
      assert.equal(putIdData.user.name, 'Updated Via Param');

      const notFoundPut = await fetch(`${base}/api/users/999`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ name: 'Does Not Exist' }),
      });
      assert.equal(notFoundPut.status, 404);

      const delId = await fetch(`${base}/api/users/10`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(delId.status, 200);
      assert.deepEqual(await delId.json(), { success: true, user: { id: 10, status: 'inactive' } });

      const notFoundDel = await fetch(`${base}/api/users/999`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(notFoundDel.status, 404);
    });

    await t.test(`${label} POST /api/admin/password changes administrator password`, async () => {
      const res = await fetch(`${base}/api/admin/password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ currentPassword: 'valid-password', newPassword: 'new-valid-password' }),
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.message, 'Password updated successfully');
      assert.ok(data.token);

      const wrong = await fetch(`${base}/api/admin/password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ currentPassword: 'wrong', newPassword: 'new-valid-password' }),
      });
      assert.equal(wrong.status, 400);
      assert.deepEqual(await wrong.json(), { error: 'Invalid current password' });
    });

    await t.test(`${label} POST /api/admin/bulk-upload CSV multipart ingestion`, async () => {
      const nonMultipart = await fetch(`${base}/api/admin/bulk-upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ role: 'student' }),
      });
      assert.equal(nonMultipart.status, 400);
      assert.deepEqual(await nonMultipart.json(), { error: 'Invalid multipart payload' });

      const missingRoleForm = new FormData();
      missingRoleForm.set('file', new File(['Name,Email\nA,a@test.io'], 'test.csv', { type: 'text/csv' }));
      const missingRole = await fetch(`${base}/api/admin/bulk-upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: missingRoleForm,
      });
      assert.equal(missingRole.status, 400);
      assert.deepEqual(await missingRole.json(), { error: 'File and role are required' });

      const badTypeForm = new FormData();
      badTypeForm.set('role', 'student');
      badTypeForm.set('file', new File(['Name,Email\nA,a@test.io'], 'test.txt', { type: 'text/plain' }));
      const badType = await fetch(`${base}/api/admin/bulk-upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: badTypeForm,
      });
      assert.equal(badType.status, 400);
      assert.deepEqual(await badType.json(), { error: 'Unsupported file type. Only CSV and Excel files are allowed.' });

      const validForm = new FormData();
      validForm.set('role', 'student');
      validForm.set('file', new File(['first_name,last_name,email,division\nJohn,Doe,john@test.io,CE1\nDup,Lic,duplicate@test.io,CE1'], 'users.csv', { type: 'text/csv' }));
      const validRes = await fetch(`${base}/api/admin/bulk-upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: validForm,
      });
      assert.equal(validRes.status, 200);
      const validData = await validRes.json();
      assert.equal(validData.success, true);
      assert.equal(validData.createdCount, 1);
      assert.equal(validData.errors.length, 1);
      assert.equal(validData.errors[0].email, 'duplicate@test.io');
    });

    await t.test(`${label} POST /api/users/bulk CSV multipart batch creation`, async () => {
      const nonMultipart = await fetch(`${base}/api/users/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ role: 'student' }),
      });
      assert.equal(nonMultipart.status, 400);
      assert.deepEqual(await nonMultipart.json(), { error: 'Invalid multipart payload' });

      const validForm = new FormData();
      validForm.set('role', 'student');
      const csvContent = 'Name,Email,Division\nFresh User,fresh@test.io,CE1\nDuplicate User,duplicate@test.io,CE1\nBad Email,invalid-email,CE1';
      validForm.set('file', new File([csvContent], 'students.csv', { type: 'text/csv' }));
      const res = await fetch(`${base}/api/users/bulk`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: validForm,
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.created.length, 1);
      assert.equal(data.skipped.length, 2);
      assert.equal(data.summary.total, 3);
    });

    await t.test(`${label} Unsupported HTTP methods return HTTP 405 Method Not Allowed`, async () => {
      for (const [url, allowed] of [
        ['/api/admin/bulk-upload', ['POST']],
        ['/api/admin/password', ['POST']],
        ['/api/users', ['DELETE', 'GET', 'HEAD', 'POST', 'PUT']],
        ['/api/users/10', ['DELETE', 'PUT']],
        ['/api/users/bulk', ['POST']],
      ]) {
        for (const method of ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].filter(m => !allowed.includes(m))) {
          const res = await fetch(`${base}${url}`, { method });
          assert.equal(res.status, 405, `${label} ${method} ${url} must return 405`);
          assert.equal(res.headers.get('cache-control'), 'no-store');
          const allowHeader = res.headers.get('allow') || '';
          for (const a of allowed) assert.ok(allowHeader.includes(a), `${label} Allow header should contain ${a}`);
        }
      }
    });
  }

  await t.test('Course slice is forwarded to API after users and courses cutover', async () => {
    for (const migrated of ['/api/courses', '/api/departments', '/api/mapping']) {
      assert.equal((await fetch(`${gatewayAddress}${migrated}`)).status, 401);
    }
  });

  await t.test('Same-origin gateway bypasses unmigrated paths to web fallback (418)', async () => {
    for (const unmigrated of ['/api/health', '/api/stats']) {
      const res = await fetch(`${gatewayAddress}${unmigrated}`);
      assert.equal(res.status, 418, `${unmigrated} must bypass API gateway`);
      assert.equal(await res.text(), 'web fallback');
    }
  });
});
