// Host lab orchestration: standard Next.js processes behind the infrastructure gateway.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createGatewayServer } from '../../infrastructure/gateway/server.mjs';
import { resolveLabEnvironment } from './lab-launcher.mjs';
import { webEnvironment } from '../lib/web-environment.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const webRoot = fileURLToPath(new URL('../../apps/web/', import.meta.url));
const env = resolveLabEnvironment(root);
const production = process.env.NODE_ENV === 'production' || process.argv.includes('--production');
const requestedCount = env.CLUSTER_ENABLED === 'true' ? Number(env.WEB_CONCURRENCY || 2) : 1;
if (!Number.isInteger(requestedCount) || requestedCount < 1 || requestedCount > 16) throw Error('WEB_CONCURRENCY must be between 1 and 16');
const count = production ? requestedCount : 1;
const firstPort = Number(env.WEB_INTERNAL_PORT || Number(env.PORT) + 20);
const ports = Array.from({ length: count }, (_, index) => firstPort + index);
if (ports.some(port => !Number.isInteger(port) || port < 1 || port > 65535 || [Number(env.PORT), Number(env.API_PORT)].includes(port))) throw Error('WEB_INTERNAL_PORT range must be valid and distinct from public/API ports');
const cli = createRequire(new URL('../../apps/web/package.json', import.meta.url)).resolve('next/dist/bin/next');
const gateway = createGatewayServer({ apiOrigin: env.INTERNAL_API_URL, webOrigins: ports.map(port => `http://127.0.0.1:${port}`) });
const children = new Set(), timers = new Set();
let stopping = false;
const delay = ms => new Promise(done => setTimeout(done, ms));
function launch(port, backoff = 250) {
  if (stopping) return;
  const started = Date.now();
  const child = spawn(process.execPath, [cli, production ? 'start' : 'dev', webRoot, '-p', String(port), '-H', '127.0.0.1'], { cwd: root, env: webEnvironment(env, { port, production }), stdio: 'inherit' });
  children.add(child);
  child.once('error', error => { console.error('Next.js startup failed:', error.message); void shutdown(1); });
  child.once('exit', () => {
    children.delete(child);
    if (stopping) return;
    const nextDelay = Date.now() - started < 10000 ? Math.min(backoff * 2, 5000) : 250;
    const timer = setTimeout(() => { timers.delete(timer); launch(port, nextDelay); }, nextDelay); timers.add(timer);
  });
  void (async () => {
    for (let attempt = 0; attempt < 120 && !stopping && child.exitCode === null && child.signalCode === null; attempt++) {
      try { const response = await fetch(`http://127.0.0.1:${port}/login`, { signal: AbortSignal.timeout(1000) }); if (response.status === 200) { console.log(`Cluster worker listening pid=${child.pid} port=${port} runtime=next`); return; } } catch {}
      await delay(250);
    }
  })();
}
let shuttingDown;
function shutdown(code = 0) {
  return shuttingDown ||= (async () => {
    stopping = true; for (const timer of timers) clearTimeout(timer);
    const exited = [...children].map(child => new Promise(done => { child.once('exit', done); child.kill('SIGTERM'); }));
    const deadline = setTimeout(() => { for (const child of children) child.kill('SIGKILL'); }, 15000); deadline.unref();
    try { await Promise.all([gateway.close(), ...exited]); }
    finally { clearTimeout(deadline); process.exitCode = code; }
  })();
}
for (const port of ports) launch(port);
gateway.server.listen(Number(env.PORT), process.env.HOSTNAME || '0.0.0.0', () => console.log(`Server ready at http://localhost:${env.PORT} (gateway -> Next.js/API)`));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void shutdown(); });
