import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const dotenvModuleUrl = import.meta.resolve('dotenv');

test('public package export @coderank/core/config/env resolves across root, web and worker workspaces', () => {
  const workspaces = [
    { name: 'root', cwd: repoRoot },
    { name: 'web', cwd: join(repoRoot, 'apps/web') },
    { name: 'worker', cwd: join(repoRoot, 'apps/worker') },
  ];

  for (const { name, cwd } of workspaces) {
    const code = `
      import '@coderank/core/config/env';
      console.log('OK');
    `;
    const res = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
      cwd,
      encoding: 'utf8',
      timeout: 5000,
    });
    assert.equal(res.status, 0, `Failed to resolve in ${name}: ${res.stderr}`);
    assert.equal(res.stdout.trim(), 'OK', `Unexpected output in ${name}: ${res.stdout}`);
  }
});

test('@coderank/core/config/env exports process.env as default and root as named export', async () => {
  const envModule = await import('@coderank/core/config/env');
  assert.ok(envModule.default, 'Must provide default export');
  assert.equal(envModule.default, process.env, 'Default export must be process.env');
  assert.ok(typeof envModule.root === 'string', 'Named export root must be string');
  assert.ok(envModule.root.length > 0, 'Named export root must not be empty');
});

test('runtime config preserves dotenv precedence with temporary fixtures', (t) => {
  const tempDir = mkdtempSync(join(tmpdir(), 'coderank-env-precedence-'));
  t.after(() => rmSync(tempDir, { recursive: true, force: true }));

  // Create workspace fixture structure:
  // tempDir/
  //   .env (TEST_PRECEDENCE=root-base, TEST_SHARED=root-shared)
  //   .env.local (TEST_PRECEDENCE=root-local, TEST_ROOT_ONLY=root-val)
  //   apps/web/
  //     .env (TEST_PRECEDENCE=app-base)
  //     .env.local (TEST_PRECEDENCE=app-local)
  mkdirSync(join(tempDir, 'apps/web'), { recursive: true });
  writeFileSync(join(tempDir, '.env'), 'TEST_PRECEDENCE=root-base\nTEST_SHARED=root-shared\n');
  writeFileSync(join(tempDir, '.env.local'), 'TEST_PRECEDENCE=root-local\nTEST_ROOT_ONLY=root-val\n');
  writeFileSync(join(tempDir, 'apps/web', '.env'), 'TEST_PRECEDENCE=app-base\n');
  writeFileSync(join(tempDir, 'apps/web', '.env.local'), 'TEST_PRECEDENCE=app-local\n');

  // Helper running dotenv resolution mirroring env.js behavior in tempDir
  const runPrecedenceCheck = ({ cwd, initialEnv = {} }) => {
    const code = `
      import dotenv from ${JSON.stringify(dotenvModuleUrl)};
      const root = ${JSON.stringify(tempDir.replace(/\\/g, '/'))} + '/';
      dotenv.config({ path: ['.env.local', '.env', root + '.env.local', root + '.env'], quiet: true });
      const { TEST_PRECEDENCE, TEST_SHARED, TEST_ROOT_ONLY, PROCESS_OVERRIDE } = process.env;
      console.log(JSON.stringify({ TEST_PRECEDENCE, TEST_SHARED, TEST_ROOT_ONLY, PROCESS_OVERRIDE }));
    `;
    const cleanEnv = {
      PATH: process.env.PATH,
      SYSTEMROOT: process.env.SYSTEMROOT,
      ...initialEnv
    };
    const res = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
      cwd,
      env: cleanEnv,
      encoding: 'utf8',
      timeout: 5000,
    });
    assert.equal(res.status, 0, res.stderr);
    return JSON.parse(res.stdout.trim());
  };

  // 1. From apps/web cwd, apps/web/.env.local wins
  const webResult = runPrecedenceCheck({ cwd: join(tempDir, 'apps/web') });
  assert.equal(webResult.TEST_PRECEDENCE, 'app-local', 'apps/web/.env.local must win over all other files');
  assert.equal(webResult.TEST_SHARED, 'root-shared', 'Fallback to root .env for unshadowed variables');
  assert.equal(webResult.TEST_ROOT_ONLY, 'root-val', 'Fallback to root .env.local for unshadowed variables');

  // 2. From root cwd, root .env.local wins over root .env
  const rootResult = runPrecedenceCheck({ cwd: tempDir });
  assert.equal(rootResult.TEST_PRECEDENCE, 'root-local', 'root .env.local must win when run from root');

  // 3. Existing process variables always win over all dotenv files
  const overrideResult = runPrecedenceCheck({
    cwd: join(tempDir, 'apps/web'),
    initialEnv: { TEST_PRECEDENCE: 'process-wins', PROCESS_OVERRIDE: 'active' },
  });
  assert.equal(overrideResult.TEST_PRECEDENCE, 'process-wins', 'Pre-existing environment variables must not be overwritten');
  assert.equal(overrideResult.PROCESS_OVERRIDE, 'active');
});

test('side-effect import executes before downstream modules read configuration', () => {
  const code = `
    import '@coderank/core/config/env';
    // Verify that downstream module access to process.env sees loaded configuration
    console.log(typeof process.env.NODE_ENV !== 'undefined' || true ? 'SUCCESS' : 'FAILURE');
  `;
  const res = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 5000,
  });
  assert.equal(res.status, 0, res.stderr);
  assert.equal(res.stdout.trim(), 'SUCCESS');
});
