import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const launcherKeys = ['PORT', 'REALTIME_URL', 'ALLOWED_ORIGIN', 'API_PORT', 'API_HOST', 'INTERNAL_API_URL'];

// Match the web bootstrap's dotenv precedence without evaluating shell syntax
// or exporting unrelated app-local secrets/configuration into the worker.
export function resolveLabEnvironment(root = repositoryRoot, inherited = process.env) {
  const selected = {};
  for (const key of launcherKeys) {
    if (inherited[key] !== undefined) selected[key] = inherited[key];
  }
  for (const file of ['apps/web/.env.local', 'apps/web/.env', '.env.local', '.env']) {
    const pathname = join(root, file);
    if (!existsSync(pathname)) continue;
    const values = parseEnv(readFileSync(pathname, 'utf8'));
    for (const key of launcherKeys) {
      if (selected[key] === undefined && values[key] !== undefined) selected[key] = values[key];
    }
  }
  const port = String(selected.PORT || '3000').trim();
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  const env = { ...inherited, PORT: port, REALTIME_URL: selected.REALTIME_URL };
  const apiPort = String(selected.API_PORT || '3001').trim();
  if (!/^\d+$/.test(apiPort) || Number(apiPort) < 1 || Number(apiPort) > 65535 || apiPort === port) {
    throw new Error('API_PORT must be a valid port different from PORT');
  }
  env.REALTIME_URL = selected.REALTIME_URL || `http://127.0.0.1:${apiPort}`;
  env.API_PORT = apiPort;
  env.API_HOST = selected.API_HOST || '127.0.0.1';
  env.INTERNAL_API_URL = selected.INTERNAL_API_URL || `http://127.0.0.1:${apiPort}`;
  // An absent origin is derived by the native launcher after LAN IP discovery.
  if (selected.ALLOWED_ORIGIN) env.ALLOWED_ORIGIN = selected.ALLOWED_ORIGIN;
  else delete env.ALLOWED_ORIGIN;
  return env;
}

export function launcherCommand(platform = process.platform, env = process.env) {
  if (platform === 'win32') {
    return { command: env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', 'call start-lab.bat --resolved-env'] };
  }
  return { command: 'bash', args: ['start-lab.sh', '--resolved-env'] };
}

export async function launchLab(root = repositoryRoot, inherited = process.env) {
  const env = resolveLabEnvironment(root, inherited);
  const { command, args } = launcherCommand(process.platform, env);
  const child = spawn(command, args, { cwd: root, env, stdio: 'inherit' });
  const interrupt = () => child.kill('SIGINT');
  const terminate = () => child.kill('SIGTERM');
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', terminate);
  try {
    return await new Promise((done, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) => done(code ?? (signal === 'SIGINT' ? 130 : 1)));
    });
  } finally {
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', terminate);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await launchLab(); }
  catch (error) { console.error(`Lab startup failed: ${error.message}`); process.exitCode = 1; }
}
