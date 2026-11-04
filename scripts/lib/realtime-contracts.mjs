import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import { io } from 'socket.io-client';

async function bounded(promise, message, timeout = 5000) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error(message)), timeout); })]); }
  finally { clearTimeout(timer); }
}

// Real API replicas, real database authority, real Redis and the actual web gateway.
export async function verifyRealtimeContracts({ base, apiBase, peerBase, token, jobId, secret, adminLogin, stopPeer }) {
  const clients = [];
  const connect = async (origin, auth, extraHeaders) => {
    const socket = io(origin, { auth, extraHeaders, transports: ['websocket'], forceNew: true, reconnection: false, timeout: 3000 });
    clients.push(socket);
    await bounded(new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); }), 'Realtime handshake timed out');
    return socket;
  };
  const serviceToken = (expiry = Math.floor(Date.now() / 1000) + 300) => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ role: 'service', aud: 'coderank-realtime', iss: 'coderank-worker', exp: expiry })).toString('base64url');
    const input = `${header}.${payload}`;
    return `${input}.${createHmac('sha256', secret).update(input).digest('base64url')}`;
  };
  try {
    const owner = await connect(base, { token });
    const peerOwner = await connect(peerBase, { token });
    const worker = await connect(peerBase, { serviceToken: serviceToken() });
    const guest = await connect(base, {}, { cookie: `coderank_execution_session=${'b'.repeat(64)}` });
    assert.equal((await owner.timeout(2000).emitWithAck('watch_job', jobId)).ok, true);
    assert.equal((await peerOwner.timeout(2000).emitWithAck('watch_job', jobId)).ok, true);
    assert.equal((await guest.timeout(2000).emitWithAck('watch_job', jobId)).ok, false);
    assert.equal((await worker.timeout(2000).emitWithAck('watch_job', jobId)).ok, false);
    assert.equal((await guest.timeout(2000).emitWithAck('worker_job_complete', { jobId })).ok, false);
    assert.equal((await guest.timeout(2000).emitWithAck('join_course_room', 1)).ok, false);
    assert.equal((await guest.timeout(2000).emitWithAck('faculty_practical_updated', { course_id: 1, practical: { id: 1 } })).ok, false);
    let leaked = false;
    guest.on('job_complete', () => { leaked = true; });
    const results = Promise.all([once(owner, 'job_complete'), once(peerOwner, 'job_complete')]);
    assert.equal((await worker.timeout(2000).emitWithAck('worker_job_complete', {
      jobId, result: { status: 'accepted', cases: [{ hidden: true, passed: true, input: 'private', expected: 'private', output: 'private' }] },
    })).ok, true);
    for (const [result] of await bounded(results, 'Cross-replica job publication timed out')) {
      assert.equal(result.jobId, jobId);
      for (const key of ['input', 'expected', 'output']) assert.equal(result.cases[0][key], undefined);
    }
    assert.equal(leaked, false);

    const adminToken = await adminLogin();
    const admin = await connect(base, { token: adminToken });
    assert.equal((await admin.timeout(2000).emitWithAck('join_course_room', 1)).ok, true);
    const notification = once(admin, 'practical_updated');
    assert.equal((await worker.timeout(2000).emitWithAck('faculty_practical_updated', { course_id: 1, practical: { id: 1, title: 'Realtime contract' } })).ok, true);
    assert.equal((await bounded(notification, 'Cross-replica practical notification timed out'))[0].id, 1);
    await adminLogin(); // Rotate the persistent session, without changing the socket's JWT.
    const revoked = once(admin, 'disconnect');
    admin.emit('join_course_room', 1);
    await bounded(revoked, 'Revoked session retained its socket');

    const expiring = await connect(apiBase, { serviceToken: serviceToken(Math.floor(Date.now() / 1000) + 3) });
    await bounded(once(expiring, 'disconnect'), 'Idle expired service session was not disconnected', 6000);
    const peerGone = once(peerOwner, 'disconnect');
    await stopPeer();
    await bounded(peerGone, 'Replica drain retained an upgraded connection');
    assert.equal(owner.connected, true, 'Draining one replica must not disconnect the other replica');
    assert.equal((await owner.timeout(2000).emitWithAck('watch_job', jobId)).ok, true);
    console.log('Realtime contracts passed: actual API replicas, gateway, Redis fan-out, ownership, privacy, revocation, expiry and replica-local drain');
  } finally {
    for (const socket of clients) socket.disconnect();
  }
}
