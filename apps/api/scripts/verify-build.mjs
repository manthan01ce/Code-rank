import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../src/app.js';

async function verify(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) await verify(url);
    else if (entry.name.endsWith('.js')) {
      const result = spawnSync(process.execPath, ['--check', fileURLToPath(url)], { stdio: 'inherit' });
      if (result.status !== 0) throw new Error(`API syntax validation failed: ${entry.name}`);
    }
  }
}
await verify(new URL('../src/', import.meta.url));
const app = buildApp();
try {
  await app.ready(); // Resolve actual framework/plugins/imports without listening or infrastructure.
  const response = await app.inject('/api/live');
  if (response.statusCode !== 200 || response.json().status !== 'ok') throw new Error('API registration validation failed');
} finally { await app.close(); }
console.log('API source, dependency imports and route registration verified');
