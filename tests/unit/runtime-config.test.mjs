import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const dotenvModuleUrl = import.meta.resolve('dotenv');

function fixtureLoader(tempDir) {
  const target = join(tempDir, 'packages/core/src/config/env.mjs');
  mkdirSync(join(tempDir, 'packages/core/src/config'), { recursive: true });
  // Exercise the real implementation; only dependency resolution changes outside the workspace.
  const source = readFileSync(join(repoRoot, 'packages/core/src/config/env.js'), 'utf8');
  writeFileSync(target, source.replace("from 'dotenv'", `from ${JSON.stringify(dotenvModuleUrl)}`));
  return pathToFileURL(target).href;
}

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

  const loaderUrl = fixtureLoader(tempDir);
  // Run the actual loader from a relocated repository fixture.
  const runPrecedenceCheck = ({ cwd, initialEnv = {} }) => {
    const code = `
      import ${JSON.stringify(loaderUrl)};
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

test('side-effect import executes before downstream modules read configuration', (t) => {
  const tempDir = mkdtempSync(join(tmpdir(), 'coderank-env-order-'));
  t.after(() => rmSync(tempDir, { recursive: true, force: true }));
  writeFileSync(join(tempDir, '.env'), 'CODERANK_IMPORT_ORDER=loaded-before-consumer\n');
  const loaderUrl = fixtureLoader(tempDir);
  const consumer = join(tempDir, 'consumer.mjs');
  writeFileSync(consumer, 'export const captured = process.env.CODERANK_IMPORT_ORDER;');
  const run = (load) => {
    const code = `${load ? `import ${JSON.stringify(loaderUrl)};` : ''}
      import { captured } from ${JSON.stringify(pathToFileURL(consumer).href)};
      console.log(JSON.stringify(captured ?? null));`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
      cwd: tempDir,
      env: { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT },
      encoding: 'utf8', timeout: 5000,
    });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout.trim());
  };
  assert.equal(run(false), null, 'Control must not inherit the fixture value');
  assert.equal(run(true), 'loaded-before-consumer');
});
