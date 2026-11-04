import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApiGateway } from '../apps/web/src/lib/api-gateway.js';
import { resolveApiEnvironment } from '../apps/api/src/config/env.js';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { buildApp } from '../apps/api/src/app.js';

test('Fastify API direct runtime contracts for GET /api/live', async (t) => {
  const app = buildApp();
  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  t.after(async () => {
    await app.close();
  });

  await t.test('GET /api/live returns HTTP 200, status ok, recent ISO timestamp and Cache-Control: no-store', async () => {
    const before = Date.now();
    const res = await fetch(`${address}/api/live`);
    const after = Date.now();

    assert.equal(res.status, 200, 'GET /api/live must return 200');
    assert.equal(res.headers.get('cache-control'), 'no-store', 'Cache-Control header must be no-store');
    
    const body = await res.json();
    assert.equal(body.status, 'ok', 'status must be ok');
    assert.ok(typeof body.timestamp === 'string', 'timestamp must be a string');
    
    const parsedTime = Date.parse(body.timestamp);
    assert.ok(!Number.isNaN(parsedTime), 'timestamp must be valid ISO 8601');
    assert.ok(parsedTime >= before - 1000 && parsedTime <= after + 1000, 'timestamp must reflect current time');
  });

  await t.test('Unsupported HTTP methods return HTTP 405 Method Not Allowed with Allow header', async () => {
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
      const hasBody = ['POST', 'PUT', 'PATCH'].includes(method);
      const res = await fetch(`${address}/api/live`, {
        method,
        headers: hasBody ? { 'Content-Type': 'application/json' } : {},
        body: hasBody ? JSON.stringify({ ping: 'pong' }) : undefined,
      });

      assert.equal(res.status, 405, `${method} /api/live must return 405`);
      assert.equal(res.headers.get('cache-control'), 'no-store', `${method} /api/live must retain cache-control: no-store`);
      assert.match(res.headers.get('allow') || '', /GET/, `${method} Allow header must include GET`);
      
      const body = await res.json();
      assert.equal(body.statusCode, 405);
      assert.equal(body.error, 'Method Not Allowed');
    }
  });

  await t.test('Oversized or malformed payload to unsupported methods returns HTTP 405', async () => {
    const hugePayload = 'x'.repeat(1024 * 1024); // 1MB
    const res = await fetch(`${address}/api/live`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: hugePayload,
    });
    assert.equal(res.status, 405);
  });

  await t.test('Unmigrated routes are not authoritative on API runtime (return 404)', async () => {
    for (const unmigratedPath of ['/api/health', '/api/users', '/api/stats']) {
      const res = await fetch(`${address}${unmigratedPath}`);
      assert.equal(res.status, 404, `${unmigratedPath} must return 404 on API runtime`);
    }
  });
});

test('API server lifecycle and clean shutdown', async () => {
  const app = buildApp();
  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  
  const res = await fetch(`${address}/api/live`);
  assert.equal(res.status, 200);

  await app.close();

  // Subsequent connection should fail
  await assert.rejects(
    async () => fetch(`${address}/api/live`, { signal: AbortSignal.timeout(1000) }),
    'Closed API server must reject incoming connections'
  );
});

test('Same-origin gateway routing and cutover contract', async (t) => {
  // 1. Start Fastify API backend
  const apiApp = buildApp();
  let forwarded;
  apiApp.addHook('onRequest', async (request, reply) => {
    forwarded = { headers: request.headers, url: request.raw.url };
    reply.header('Set-Cookie', ['gateway_probe=synthetic; HttpOnly; Path=/']);
  });
  const apiAddress = await apiApp.listen({ host: '127.0.0.1', port: 0 });

  // Use the exact production gateway imported by apps/web/server.js.
  const proxyApi = createApiGateway({ origin: apiAddress });
  const gateway = http.createServer((req, res) => {
    if (!proxyApi(req, res)) { res.writeHead(418); res.end('web fallback'); }
  });

  await new Promise((resolve) => gateway.listen(0, '127.0.0.1', resolve));
  const gatewayAddress = `http://127.0.0.1:${gateway.address().port}`;

  t.after(async () => {
    await apiApp.close();
    await new Promise((resolve) => gateway.close(resolve));
  });

  await t.test('Gateway proxies GET /api/live to API runtime', async () => {
    const res = await fetch(`${gatewayAddress}/api/live`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.ok(typeof body.timestamp === 'string');
  });

  await t.test('production gateway preserves query, auth, cookies and response cookies', async () => {
    const res = await fetch(`${gatewayAddress}/api/live?probe=1`, { headers: { Authorization: 'Bearer synthetic', Cookie: 'probe=synthetic' } });
    assert.equal(res.status, 200);
    assert.equal(forwarded.url, '/api/live?probe=1');
    assert.equal(forwarded.headers.authorization, 'Bearer synthetic');
    assert.equal(forwarded.headers.cookie, 'probe=synthetic');
    assert.match(res.headers.get('set-cookie'), /gateway_probe=synthetic/);
  });

  await t.test('Gateway forwards unsupported methods on /api/live to API runtime (405)', async () => {
    const res = await fetch(`${gatewayAddress}/api/live`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true }),
    });
    assert.equal(res.status, 405);
    assert.equal(res.headers.get('cache-control'), 'no-store');
  });

  await t.test('unmigrated paths bypass API forwarding', async () => {
    for (const path of ['/api/health', '/api/live-extra']) {
      const res = await fetch(`${gatewayAddress}${path}`);
      assert.equal(res.status, 418, 'Only the migrated exact path may be forwarded');
    }
  });
  await t.test('API outage is visible as an uncached 502', async () => {
    await apiApp.close();
    const res = await fetch(`${gatewayAddress}/api/live`);
    assert.equal(res.status, 502);
    assert.equal(res.headers.get('cache-control'), 'no-store');
  });
});

test('API environment isolates the web port and ignores inherited machine HOSTNAME', () => {
  assert.deepEqual(resolveApiEnvironment({ PORT: '3010', HOSTNAME: 'machine-name' }), { port: 3001, host: '127.0.0.1' });
  assert.deepEqual(resolveApiEnvironment({ API_PORT: '3112', API_HOST: '0.0.0.0' }), { port: 3112, host: '0.0.0.0' });
  for (const API_PORT of ['0', '65536', '3001junk']) assert.throws(() => resolveApiEnvironment({ API_PORT }), /API_PORT/);
});

test('actual API entry point handles SIGTERM and frees its listening port', async (t) => {
  const reservation = http.createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const child = spawn(process.execPath, ['apps/api/src/server.js'], {
    env: { ...process.env, API_PORT: String(port), API_HOST: '127.0.0.1', PORT: '3010' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => { if (child.exitCode === null) child.kill('SIGKILL'); });
  const exited = once(child, 'exit');
  let ready = false;
  for (let count = 0; count < 200; count++) {
    assert.equal(child.exitCode, null, 'API process exited before readiness');
    try { ready = (await fetch(`http://127.0.0.1:${port}/api/live`)).status === 200; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  assert.ok(ready, 'API must listen on the explicit runtime port');
  child.kill('SIGTERM');
  const deadline = setTimeout(() => child.kill('SIGKILL'), 5000);
  const [code, signal] = await exited;
  clearTimeout(deadline);
  if (process.platform === 'win32') {
    assert.ok(code === 0 || signal === 'SIGTERM');
  } else {
    assert.equal(code, 0);
    assert.equal(signal, null);
  }
  await assert.rejects(fetch(`http://127.0.0.1:${port}/api/live`));
});
