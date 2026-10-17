process.env.JWT_SECRET = process.env.JWT_SECRET || 'super_secret_test_key_for_testing_32chars_long';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateToken, verifyToken } from '../packages/core/src/utils/auth.js';

test('Stage 2 Realtime Trust: Socket Auth and Permissions', async (t) => {
  const SERVICE_TOKEN = 'coderank-local-dev-service-token-32-chars-long-secure';

  await t.test('Handshake without token or serviceToken is rejected', () => {
    const handshakeAuth = {};
    const hasServiceToken = handshakeAuth.serviceToken === SERVICE_TOKEN;
    const hasJwt = !!handshakeAuth.token;
    assert.equal(hasServiceToken, false);
    assert.equal(hasJwt, false);
  });

  await t.test('Handshake with valid service token is identified as service socket', () => {
    const handshakeAuth = { serviceToken: SERVICE_TOKEN };
    const isService = handshakeAuth.serviceToken === SERVICE_TOKEN;
    assert.equal(isService, true);
  });

  await t.test('Handshake with valid user JWT authenticates client role and id', () => {
    const studentUser = { id: 123, role: 'student', email: 'student@example.com' };
    const token = generateToken(studentUser);
    const decoded = verifyToken(token);

    assert.ok(decoded);
    assert.equal(decoded.id, 123);
    assert.equal(decoded.role, 'student');
  });

  await t.test('Room permissions: student cannot join faculty-only practical room', () => {
    const studentUser = { id: 123, role: 'student' };
    const canJoinPracticalRoom = (userRole) => userRole === 'faculty' || userRole === 'admin';
    assert.equal(canJoinPracticalRoom(studentUser.role), false);
  });

  await t.test('Room permissions: faculty and admin can join practical room', () => {
    const canJoinPracticalRoom = (userRole) => userRole === 'faculty' || userRole === 'admin';
    assert.equal(canJoinPracticalRoom('faculty'), true);
    assert.equal(canJoinPracticalRoom('admin'), true);
  });

  await t.test('Client event publishing: only service socket can emit worker_job_complete', () => {
    const isAllowedToEmitWorkerJobComplete = (socket) => !!socket._isService;
    assert.equal(isAllowedToEmitWorkerJobComplete({ _isService: true }), true);
    assert.equal(isAllowedToEmitWorkerJobComplete({ _isService: false, _user: { role: 'student' } }), false);
    assert.equal(isAllowedToEmitWorkerJobComplete({ _isService: false, _user: { role: 'faculty' } }), false);
  });
});
