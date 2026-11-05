import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { io as connectClient } from 'socket.io-client';
import { once } from 'node:events';
import { buildApp } from '../../apps/api/src/app.js';
import { createApiGateway } from '../../infrastructure/gateway/proxy.mjs';
import { createServiceToken } from '../../packages/core/src/security/service-token.js';
import { generateToken, verifyToken } from '../../packages/core/src/utils/auth.js';
import { publishPractical } from '../fixtures/practical-publisher.mjs';

process.env.JWT_SECRET = 'test-realtime-secret-key-3c';

const clientSockets = new Set();
function client(address, options = {}) {
  const c = connectClient(address, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    ...options,
  });
  clientSockets.add(c);
  return c;
}

function closeClients() {
  for (const c of clientSockets) {
    try {
      c.disconnect();
    } catch {}
  }
  clientSockets.clear();
}

describe('Fastify API Socket.IO runtime and same-origin gateway cutover', () => {
  let apiApp, apiAddress, proxyApi, gateway, gatewayAddress;
  const apiSockets = new Set();
  const sockets = new Set();

  before(async () => {
    apiApp = buildApp({
      realtime: {
        authorization: { getJobStatus: async () => null },
        authenticateToken: async (token) => {
          const claims = verifyToken(token);
          if (!claims) throw new Error('Invalid token');
          return claims;
        },
      },
    });
    apiAddress = await apiApp.listen({ host: '127.0.0.1', port: 0 });

    proxyApi = createApiGateway({ origin: apiAddress });
    gateway = http.createServer((req, res) => {
      if (!proxyApi(req, res)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });
    gateway.on('upgrade', (req, socket, head) => {
      if (proxyApi.upgrade?.(req, socket, head)) return;
      socket.destroy();
    });

    apiApp.server.on('connection', (s) => {
      apiSockets.add(s);
      s.on('close', () => apiSockets.delete(s));
    });

    gateway.on('connection', (s) => {
      sockets.add(s);
      s.on('close', () => sockets.delete(s));
    });

    await new Promise(resolve => gateway.listen(0, '127.0.0.1', resolve));
    gatewayAddress = `http://127.0.0.1:${gateway.address().port}`;
  });

  after(async () => {
    closeClients();
    proxyApi?.close?.();
    for (const s of sockets) s.destroy();
    if (gateway) await new Promise(resolve => gateway.close(resolve));
    if (apiApp) await apiApp.close();
  });

  test('Direct API Socket.IO connects with valid service token', async (t) => {
    const serviceToken = createServiceToken();
    const c = client(apiAddress, { auth: { serviceToken } });
    t.after(() => c.disconnect());
    await once(c, 'connect');
    assert.equal(c.connected, true);
  });

  const guestCookie = 'coderank_execution_session=' + 'a'.repeat(64);

  test('Direct API Socket.IO connects as guest with guest cookie', async (t) => {
    const c = client(apiAddress, {
      extraHeaders: {
        cookie: guestCookie,
      },
    });
    t.after(() => c.disconnect());
    await once(c, 'connect');
    assert.equal(c.connected, true);
  });

  test('Direct API Socket.IO rejects connection without credentials', async (t) => {
    const c = client(apiAddress);
    t.after(() => c.disconnect());
    const [err] = await once(c, 'connect_error');
    assert.match(err.message, /Authentication required/);
  });

  test('Gateway proxies WebSocket upgrade to API Socket.IO server', async (t) => {
    const serviceToken = createServiceToken();
    const c = client(gatewayAddress, { auth: { serviceToken } });
    t.after(() => c.disconnect());
    await once(c, 'connect');
    assert.equal(c.connected, true);
  });

  test('Worker job completion broadcasts to subscriber through gateway', async (t) => {
    // 1. Worker connects directly to API with service token
    const serviceToken = createServiceToken();
    const worker = client(apiAddress, { auth: { serviceToken } });
    t.after(() => worker.disconnect());
    await once(worker, 'connect');

    // 2. Browser client connects through gateway as guest
    const browser = client(gatewayAddress, {
      extraHeaders: {
        cookie: guestCookie,
      },
    });
    t.after(() => browser.disconnect());
    await once(browser, 'connect');

    // 3. Worker sends completion
    const completeReceived = once(browser, 'job_complete');
    await worker.timeout(2000).emitWithAck('worker_job_complete', {
      jobId: 'fake-job-id',
      result: { status: 'accepted', cases: [{ hidden: true, passed: true, input: 'hide', expected: 'hide' }] },
    });

    // 4. Non-subscriber should NOT receive it
    const timedOut = await Promise.race([
      completeReceived.then(() => false),
      new Promise(r => setTimeout(() => r(true), 200)),
    ]);
    assert.equal(timedOut, true, 'Non-subscriber must not receive un-watched job complete');

    // Now subscribe to job
    const ack = await browser.timeout(2000).emitWithAck('watch_job', 'fake-job-id');
    // For guest/fake job without db record, getJobStatus returns null/throws
    assert.equal(ack.ok, false, 'Invalid/unauthorized job watch is rejected');
  });

  test('Transitional web practical publisher sends events to API Socket.IO server', async (t) => {
    assert.ok(apiApp.publisher, 'Publisher must be available to sibling API feature modules');
    const courseId = 99;
    const serviceToken = createServiceToken();

    // Browser joins course room
    const adminToken = generateToken({ id: 1, role: 'admin' });
    const browser = client(gatewayAddress, { auth: { token: adminToken } });
    t.after(() => browser.disconnect());
    await once(browser, 'connect');

    const joinAck = await browser.timeout(2000).emitWithAck('join_course_room', courseId);
    assert.equal(joinAck.ok, true, 'Admin can join course room');

    const eventPromise = once(browser, 'practical_added');

    // Call web publishPractical pointing to API address
    process.env.REALTIME_URL = apiAddress;
    const pubSocket = publishPractical('added', { id: 42, course_id: courseId, title: 'Test Practical' });
    t.after(() => {
      pubSocket?.disconnect();
    });

    const [payload] = await Promise.race([
      eventPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Event timeout')), 3000)),
    ]);
    assert.equal(payload.id, 42);
    assert.equal(payload.title, 'Test Practical');
    const localEvent = once(browser, 'practical_updated');
    apiApp.publisher.publishPracticalChange('updated', { courseId, practical: { id: 42, title: 'Local API update' } });
    assert.equal((await localEvent)[0].title, 'Local API update');
  });

  test('Unrelated WebSocket upgrade requests are rejected by gateway', async () => {
    const rawReq = http.request(gatewayAddress + '/unrelated-path', {
      agent: false,
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
        'Sec-WebSocket-Version': '13',
      },
    });
    const errorPromise = once(rawReq, 'error');
    rawReq.end();
    // Gateway destroys socket for non-socket.io upgrade
    await errorPromise;
    rawReq.destroy();
  });
  test('API close drains connected direct and gateway WebSockets without process exit', async () => {
    const direct = client(apiAddress, { auth: { serviceToken: createServiceToken() } });
    const proxied = client(gatewayAddress, { auth: { serviceToken: createServiceToken() } });
    await Promise.all([once(direct, 'connect'), once(proxied, 'connect')]);
    const gone = Promise.all([once(direct, 'disconnect'), once(proxied, 'disconnect')]);
    let timer;
    try {
      await Promise.race([
        Promise.all([apiApp.close(), gone]),
        new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Realtime close did not drain live connections')), 3000); }),
      ]);
    } finally { clearTimeout(timer); }
    assert.equal(direct.connected, false);
    assert.equal(proxied.connected, false);
    await assert.rejects(fetch(`${apiAddress}/api/live`));
  });

});
