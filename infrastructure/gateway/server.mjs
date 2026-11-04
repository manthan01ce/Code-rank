import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createApiGateway, createWebGateway } from './proxy.mjs';

export function createGatewayServer({ apiOrigin = process.env.INTERNAL_API_URL || 'http://127.0.0.1:3001', webOrigins = [process.env.INTERNAL_WEB_URL || 'http://127.0.0.1:3020'] } = {}) {
  if (!webOrigins.length) throw Error('At least one web origin is required');
  const api = createApiGateway({ origin: apiOrigin });
  const web = webOrigins.map(origin => createWebGateway({ origin }));
  let sequence = 0;
  const server = http.createServer((req, res) => {
    if (!req.url.startsWith('/') || req.url.startsWith('//')) { res.writeHead(400); res.end(); return; }
    if (!api(req, res)) web[sequence++ % web.length](req, res);
  });
  server.on('upgrade', (req, socket, head) => {
    if (!req.url.startsWith('/') || req.url.startsWith('//')) { socket.destroy(); return; }
    if (!api.upgrade(req, socket, head) && !web[0].upgrade(req, socket, head)) socket.destroy();
  });
  let closing;
  const close = () => closing ||= (async () => {
    api.close(); for (const proxy of web) proxy.close();
    const deadline = setTimeout(() => server.closeAllConnections(), 10000); deadline.unref();
    try { await new Promise((done, reject) => server.close(error => error ? reject(error) : done())); }
    finally { clearTimeout(deadline); }
  })();
  return { server, close };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const gateway = createGatewayServer();
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('PORT must be valid');
  gateway.server.listen(port, process.env.HOSTNAME || '0.0.0.0', () => console.log(`Gateway listening on ${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => gateway.close().catch(error => { console.error(error.message); process.exitCode = 1; }));
}
