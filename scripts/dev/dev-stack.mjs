import { spawn } from 'node:child_process';
import { resolveLabEnvironment } from './lab-launcher.mjs';
const env = resolveLabEnvironment();
const children = ['apps/api/src/server.js', 'apps/worker/src/index.js', 'scripts/dev/web-runtime.mjs'].map(script => spawn(process.execPath, [script], { env, stdio: 'inherit' }));
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true; process.exitCode = code;
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => stop());
for (const child of children) {
  child.once('error', error => { console.error(error.message); stop(1); });
  child.once('exit', code => { if (!stopping) stop(code || 1); });
}
