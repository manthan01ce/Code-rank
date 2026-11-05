import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveLabEnvironment, launcherCommand } from '../../scripts/dev/lab-launcher.mjs';

function fixture(t, files = {}) {
  const root = mkdtempSync(join(tmpdir(), 'coderank launcher-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'apps/web'), { recursive: true });
  for (const [name, value] of Object.entries(files)) writeFileSync(join(root, name), value);
  return root;
}

test('launcher preserves the web port and derives worker realtime from the API port', t => {
  const root = fixture(t, { '.env': 'PORT=3010\n' });
  const env = resolveLabEnvironment(root, {});
  assert.equal(env.PORT, '3010');
  assert.equal(env.REALTIME_URL, 'http://127.0.0.1:3001');
  assert.equal(env.ALLOWED_ORIGIN, undefined);
});

test('launcher dotenv precedence matches web bootstrap while process overrides win', t => {
  const root = fixture(t, {
    '.env': 'PORT=3010\n',
    '.env.local': 'PORT=3020\n',
    'apps/web/.env': 'PORT=3030\n',
    'apps/web/.env.local': 'PORT=3040\n',
  });
  assert.equal(resolveLabEnvironment(root, {}).PORT, '3040');
  assert.equal(resolveLabEnvironment(root, { PORT: '3050' }).PORT, '3050');
  assert.equal(resolveLabEnvironment(root, { PORT: '3050' }).REALTIME_URL, 'http://127.0.0.1:3001');
});

test('launcher preserves explicit dotenv realtime/origins and process overrides', t => {
  const root = fixture(t, { '.env': 'PORT=3010\nREALTIME_URL=https://relay.example.test\nALLOWED_ORIGIN=https://portal.example.test\n' });
  const env = resolveLabEnvironment(root, {});
  assert.equal(env.REALTIME_URL, 'https://relay.example.test');
  assert.equal(env.ALLOWED_ORIGIN, 'https://portal.example.test');
  assert.equal(resolveLabEnvironment(root, { REALTIME_URL: 'https://override.example.test' }).REALTIME_URL, 'https://override.example.test');
});

test('launcher parses dotenv as data and does not export unrelated app configuration', t => {
  const sentinel = join(tmpdir(), 'coderank-must-not-execute-' + Date.now());
  const root = fixture(t, { 'apps/web/.env.local': 'PORT=3010\nDATABASE_URL=must-not-leak\nALLOWED_ORIGIN="$(touch ' + sentinel + '); https://example.test"\n' });
  const env = resolveLabEnvironment(root, { DATABASE_URL: 'inherited-value' });
  assert.equal(env.DATABASE_URL, 'inherited-value');
  assert.equal(env.ALLOWED_ORIGIN, '$(touch ' + sentinel + '); https://example.test');
  assert.equal(existsSync(sentinel), false);
});

test('launcher defaults are bounded and invalid ports fail before startup', t => {
  const root = fixture(t);
  assert.equal(resolveLabEnvironment(root, {}).PORT, '3000');
  for (const PORT of ['0', '65536', 'abc', '3000;echo bad']) {
    assert.throws(() => resolveLabEnvironment(root, { PORT }), /PORT must/);
  }
  assert.equal(resolveLabEnvironment(root, { PORT: '65535' }).PORT, '65535');
});

test('both native launchers delegate to the shared resolver before applying defaults', () => {
  const sh = readFileSync(new URL('../../start-lab.sh', import.meta.url), 'utf8');
  const bat = readFileSync(new URL('../../start-lab.bat', import.meta.url), 'utf8');
  assert.ok(sh.indexOf('exec node scripts/dev/lab-launcher.mjs') < sh.indexOf('export PORT='));
  assert.ok(bat.indexOf('node scripts\\dev\\lab-launcher.mjs') < bat.indexOf('if not defined PORT set PORT='));
  assert.match(sh, /--resolved-env/);
  assert.match(bat, /--resolved-env/);
  assert.deepEqual(launcherCommand('linux').args, ['start-lab.sh', '--resolved-env']);
  const windows = launcherCommand('win32', { ComSpec: 'cmd.exe' });
  assert.equal(windows.command, 'cmd.exe');
  assert.equal(windows.args.at(-1), 'call start-lab.bat --resolved-env');
});

test('launcher bridge passes resolved values to a real child and preserves its exit code', t => {
  const root = fixture(t, { '.env': 'PORT=3099\n' });
  writeFileSync(join(root, 'start-lab.sh'), '#!/bin/sh\nprintf "%s|%s\\n" "$PORT" "$REALTIME_URL"\nexit 7\n');
  writeFileSync(join(root, 'start-lab.bat'), '@echo off\r\necho %PORT%^|%REALTIME_URL%\r\nexit /b 7\r\n');
  const inherited = { ...process.env };
  for (const key of ['PORT', 'REALTIME_URL', 'ALLOWED_ORIGIN', 'API_PORT', 'API_HOST', 'INTERNAL_API_URL']) delete inherited[key];
  const moduleUrl = new URL('../../scripts/dev/lab-launcher.mjs', import.meta.url).href;
  const code = `import { launchLab } from ${JSON.stringify(moduleUrl)}; process.exitCode = await launchLab(${JSON.stringify(root)});`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { env: inherited, encoding: 'utf8', timeout: 10000 });
  assert.ifError(result.error);
  assert.equal(result.status, 7, result.stderr);
  assert.match(result.stdout, /3099\|http:\/\/127\.0\.0\.1:3001/);
});

test('launcher derives a separate API origin and preserves explicit overrides', t => {
  const root = fixture(t, { '.env': 'PORT=3010\nAPI_PORT=3110\n' });
  const env = resolveLabEnvironment(root, {});
  assert.equal(env.API_PORT, '3110');
  assert.equal(env.REALTIME_URL, 'http://127.0.0.1:3110');
  assert.equal(env.INTERNAL_API_URL, 'http://127.0.0.1:3110');
  assert.equal(env.API_HOST, '127.0.0.1');
  assert.equal(resolveLabEnvironment(root, { API_PORT: '3210' }).INTERNAL_API_URL, 'http://127.0.0.1:3210');
  assert.throws(() => resolveLabEnvironment(root, { API_PORT: '3010' }), /API_PORT/);
});
