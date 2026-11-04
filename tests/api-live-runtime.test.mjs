import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
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
    for (const unmigratedPath of ['/api/auth/login', '/api/health', '/api/users', '/api/courses']) {
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
  const apiAddress = await apiApp.listen({ host: '127.0.0.1', port: 0 });
  const apiPort = new URL(apiAddress).port;

  // 2. Start Gateway proxy representing the web origin
  const gateway = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    // Migrated route: explicitly proxy /api/live to API backend
    if (url.pathname === '/api/live') {
      const proxyReq = http.request(
        `http://127.0.0.1:${apiPort}${req.url}`,
        {
          method: req.method,
          headers: req.headers,
        },
        (proxyRes) => {
          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          proxyRes.pipe(res);
        }
      );
      proxyReq.on('error', () => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Bad Gateway' }));
      });
      req.pipe(proxyReq);
      return;
    }

    // Unmigrated route: handled locally on Web
    if (url.pathname === '/api/auth/login') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Email and password required (handled by Web)' }));
      return;
    }

    if (url.pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ status: 'healthy', source: 'web' }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
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

  await t.test('Gateway forwards unsupported methods on /api/live to API runtime (405)', async () => {
    const res = await fetch(`${gatewayAddress}/api/live`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true }),
    });
    assert.equal(res.status, 405);
    assert.equal(res.headers.get('cache-control'), 'no-store');
  });

  await t.test('Gateway preserves unmigrated endpoints on web tier', async () => {
    const loginRes = await fetch(`${gatewayAddress}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(loginRes.status, 400);
    const loginBody = await loginRes.json();
    assert.match(loginBody.error, /handled by Web/);

    const healthRes = await fetch(`${gatewayAddress}/api/health`);
    assert.equal(healthRes.status, 200);
    const healthBody = await healthRes.json();
    assert.equal(healthBody.source, 'web');
  });
});
