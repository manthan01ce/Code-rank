import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createGatewayServer } from '../../infrastructure/gateway/server.mjs';
import { createApiGateway } from '../../infrastructure/gateway/proxy.mjs';
const listen = server => new Promise(done => server.listen(0, '127.0.0.1', () => done(`http://127.0.0.1:${server.address().port}`)));
const close = server => new Promise(done => server.close(done));

test('gateway bounds an unresolved DNS lookup before a socket timeout can start', async () => {
  const request = http.request;
  const patched = mock.method(http, 'request', (options, ...rest) => request({
    ...options, lookup: () => { /* Deliberately stalled OS lookup fault. */ },
  }, ...rest));
  const proxy = createApiGateway({ origin: 'http://stalled.invalid:3001', timeoutMs: 50 });
  const server = http.createServer((req, res) => proxy(req, res));
  const base = await listen(server);
  try {
    const response = await fetch(`${base}/api/live`, { signal: AbortSignal.timeout(1500) });
    assert.equal(response.status, 504);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { error: 'API gateway timeout' });
  } finally { patched.mock.restore(); proxy.close(); await close(server); }
});

test('external gateway has one API owner for all API paths, preserves cookies/query, and keeps pages available through API outage', async () => {
  const api = http.createServer((req, res) => {
    res.setHeader('set-cookie', ['first=one; HttpOnly', 'second=two; SameSite=Lax']);
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ owner: 'api', path: req.url, cookie: req.headers.cookie }));
  });
  const web = http.createServer((req, res) => { res.setHeader('content-type', 'text/plain'); res.end(`web:${req.url}`); });
  const apiOrigin = await listen(api), webOrigin = await listen(web);
  const gateway = createGatewayServer({ apiOrigin, webOrigins: [webOrigin] });
  const base = await listen(gateway.server);
  try {
    for (const path of ['/api/live', '/api/profile/handle?x=1', '/api/unknown-final-route', '/socket.io/?transport=polling']) {
      const response = await fetch(base + path, { headers: { cookie: 'owner=one' } });
      assert.equal(response.status, 200);
      assert.equal(response.headers.getSetCookie().length, 2);
      assert.deepEqual(await response.json(), { owner: 'api', path, cookie: 'owner=one' });
    }
    assert.equal(await (await fetch(base + '/login')).text(), 'web:/login');
    assert.equal(await (await fetch(base + '/api-like-page')).text(), 'web:/api-like-page');
    await close(api);
    const unavailable = await fetch(base + '/api/live');
    assert.equal(unavailable.status, 502); assert.equal(unavailable.headers.get('cache-control'), 'no-store');
    assert.equal(await (await fetch(base + '/login')).text(), 'web:/login');
  } finally { await gateway.close(); if (api.listening) await close(api); await close(web); }
});
