import http from 'node:http';
import https from 'node:https';

const hopHeaders = ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade'];
function forwardedHeaders(headers) {
  const result = { ...headers };
  for (const name of [...hopHeaders, ...(headers.connection || '').split(',').map(value => value.trim().toLowerCase())]) delete result[name];
  return result;
}

// Transitional same-origin gateway. Only explicitly migrated URLs belong to API.
// Resolve at process startup: the same built web artifact runs on host and Docker.
const migratedPaths = new Set([
  '/api/live',
  '/api/auth/login',
  '/api/auth/change-password',
  '/api/auth/profile',
  '/api/admin/bulk-upload',
  '/api/admin/password',
  '/api/users',
  '/api/courses',
  '/api/departments',
  '/api/mapping',
  '/api/faculty/batches',
  '/api/faculty/courses',
  '/api/faculty/practicals',
  '/api/student/practicals',
  '/api/c-run',
  '/api/cpp-run',
  '/api/java-run',
  '/api/javascript-run',
  '/api/python-run',
  '/api/run',
  '/api/practice-run',
  '/api/execute',
]);

const migratedPracticalPatterns = [
  /^\/api\/faculty\/courses\/[^/]+\/stats$/,
  /^\/api\/faculty\/practicals\/[^/]+$/,
  /^\/api\/faculty\/practicals\/[^/]+\/(extra-time|stats)$/,
  /^\/api\/student\/practicals\/[^/]+$/,
];

function isMigratedPath(pathname) {
  return migratedPaths.has(pathname) ||
    pathname.startsWith('/api/users/') ||
    pathname.startsWith('/api/courses/') ||
    pathname.startsWith('/api/departments/') ||
    pathname.startsWith('/api/jobs/') ||
    pathname === '/socket.io' || pathname.startsWith('/socket.io/') ||
    migratedPracticalPatterns.some(pattern => pattern.test(pathname));
}

export function createApiGateway({ origin = process.env.INTERNAL_API_URL || 'http://127.0.0.1:3001', timeoutMs = 10000 } = {}) {
  const target = new URL(origin);
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || target.pathname !== '/' || target.search || target.hash) {
    throw new Error('INTERNAL_API_URL must be an HTTP(S) origin without credentials or a path');
  }

  const proxy = (req, res) => {
    if (!isMigratedPath(req.url.split('?')[0])) return false;
    const fail = (status) => {
      if (res.destroyed) return;
      if (res.headersSent) { res.destroy(); return; }
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: status === 504 ? 'API gateway timeout' : 'API unavailable' }));
    };
    const headers = forwardedHeaders(req.headers);
    headers.host = target.host;
    headers['x-forwarded-host'] = req.headers.host;
    headers['x-forwarded-proto'] = req.socket.encrypted ? 'https' : 'http';
    const upstream = (target.protocol === 'https:' ? https : http).request(new URL(req.url, target), { method: req.method, headers, agent: false }, response => {
      res.writeHead(response.statusCode, forwardedHeaders(response.headers));
      response.on('error', () => res.destroy());
      response.pipe(res);
    });
    upstream.on('error', () => fail(502));
    upstream.setTimeout(timeoutMs, () => { fail(504); upstream.destroy(); });
    req.on('aborted', () => upstream.destroy());
    res.on('close', () => { if (!res.writableFinished) upstream.destroy(); });
    req.pipe(upstream);
    return true;
  };

  const activeSockets = new Set();
  const track = (s) => {
    if (!s) return;
    activeSockets.add(s);
    s.once('close', () => activeSockets.delete(s));
  };

  proxy.close = () => {
    for (const s of activeSockets) {
      try { s.destroy(); } catch {}
    }
    activeSockets.clear();
  };

  proxy.upgrade = (req, clientSocket, head) => {
    const pathname = req.url.split('?')[0];
    if (pathname !== '/socket.io' && !pathname.startsWith('/socket.io/')) return false;

    track(clientSocket);
    const headers = { ...req.headers };
    headers.host = target.host;
    headers['x-forwarded-host'] = req.headers.host;
    headers['x-forwarded-proto'] = req.socket.encrypted ? 'https' : 'http';

    const upstream = (target.protocol === 'https:' ? https : http).request({
      hostname: target.hostname,
      port: target.port,
      path: req.url,
      method: req.method,
      headers,
      agent: false,
    });

    // Bound only the handshake; a healthy idle WebSocket must stay open.
    upstream.setTimeout(timeoutMs, () => { upstream.destroy(); clientSocket.destroy(); });
    clientSocket.on('error', () => upstream.destroy());
    clientSocket.on('close', () => upstream.destroy());
    upstream.on('response', response => {
      clientSocket.end(`HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
      response.resume();
      upstream.destroy();
    });
    upstream.on('upgrade', (res, upstreamSocket, upstreamHead) => {
      upstream.setTimeout(0);
      upstreamSocket.setTimeout(0);
      track(upstreamSocket);
      let raw = 'HTTP/1.1 101 Switching Protocols\r\n';
      for (let i = 0; i < res.rawHeaders.length; i += 2) {
        raw += `${res.rawHeaders[i]}: ${res.rawHeaders[i + 1]}\r\n`;
      }
      raw += '\r\n';
      clientSocket.write(raw);
      if (upstreamHead?.length) clientSocket.write(upstreamHead);
      if (head?.length) upstreamSocket.write(head);
      upstreamSocket.pipe(clientSocket);
      clientSocket.pipe(upstreamSocket);
      upstreamSocket.on('error', () => clientSocket.destroy());
      clientSocket.on('error', () => upstreamSocket.destroy());
      upstreamSocket.on('close', () => clientSocket.destroy());
      clientSocket.on('close', () => upstreamSocket.destroy());
    });

    upstream.on('error', () => clientSocket.destroy());
    upstream.end();
    return true;
  };

  return proxy;
}
