import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createApiGateway } from '../apps/web/src/lib/api-gateway.js';

async function unusedPort() {
  const server = http.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

test('real auth HTTP preserves malformed/unauthorized errors and fails closed on a Redis outage', async (t) => {
  const port = await unusedPort();
  const redisPort = await unusedPort();
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['apps/api/src/server.js'], {
    env: { ...process.env, API_PORT: String(port), API_HOST: '127.0.0.1', REDIS_HOST: '127.0.0.1', REDIS_PORT: String(redisPort), DISABLE_RATE_LIMIT: 'false', JWT_SECRET: 'http-outage-test-only' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => { if (child.exitCode === null) child.kill('SIGKILL'); });
  const exited = once(child, 'exit');
  let ready = false;
  for (let attempt = 0; attempt < 200; attempt++) {
    assert.equal(child.exitCode, null);
    try { ready = (await fetch(`${origin}/api/live`)).status === 200; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  assert.ok(ready);
  const proxy = createApiGateway({ origin });
  const gateway = http.createServer((req, res) => { if (!proxy(req, res)) res.end('web'); });
  await new Promise(resolve => gateway.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => gateway.close(resolve)));
  for (const base of [origin, `http://127.0.0.1:${gateway.address().port}`]) {
    let response = await fetch(`${base}/api/auth/login`, { method: 'POST' });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'Invalid JSON' });
    response = await fetch(`${base}/api/auth/login`);
    assert.equal(response.status, 405);
    assert.equal(await response.text(), '');
    response = await fetch(`${base}/api/auth/profile`, { method: 'OPTIONS' });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('allow'), 'GET, HEAD, OPTIONS, PUT');
    response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'Invalid JSON' });
    response = await fetch(`${base}/api/auth/change-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(response.status, 401);
    response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'outage@example.invalid', password: 'synthetic-password' }) });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('retry-after'), '5');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { error: 'Sign-in is temporarily unavailable. Please try again shortly.' });
  }
  child.kill('SIGTERM');
  const deadline = setTimeout(() => child.kill('SIGKILL'), 5000);
  const [code, signal] = await exited;
  clearTimeout(deadline);
  assert.equal(code, 0, 'Resource failure must still permit a clean process shutdown');
  assert.equal(signal, null);
});
