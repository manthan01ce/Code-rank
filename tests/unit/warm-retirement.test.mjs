import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = fileURLToPath(new URL('../../', import.meta.url));
const read = file => readFileSync(resolve(root, file), 'utf8');

test('retired warm configuration has no deployable overlay or active daemon consumers', () => {
  assert.equal(existsSync(resolve(root, 'infrastructure/compose.warm-daemons.yaml')), false);
  for (const file of ['docs/getting-started.md', '.github/workflows/architecture-checks.yml']) {
    assert.doesNotMatch(read(file), /-f infrastructure\/compose\.warm-daemons\.yaml/);
  }
  assert.doesNotMatch(read('scripts/dev/check-system.ps1'), /coderank-(?:python|cpp|c|java|javascript)-daemon/);
  const source = read('packages/runner/src/sandbox/Sandbox.js');
  assert.doesNotMatch(source, /if\s*\(this\.isWarm\)|No such container|coderank-\$\{this\.language\}-daemon/);
  const dockerfiles = [];
  function walk(dir) {
    for (const entry of readdirSync(resolve(root, dir), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(path); else if (entry.name === 'Dockerfile') dockerfiles.push(path);
    }
  }
  walk('infrastructure/docker');
  assert.deepEqual(dockerfiles, ['infrastructure/docker/runner/Dockerfile']);
});

test('worker rejects a stale warm opt-in before allocating queues or Docker', () => {
  const result = spawnSync(process.execPath, ['apps/worker/src/index.js'], {
    cwd: root, env: { ...process.env, USE_WARM_DAEMONS: 'true' }, encoding: 'utf8', timeout: 10000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /WARM_DAEMONS_RETIRED/);
  assert.doesNotMatch(result.stdout, /Worker Starting|initialized and listening/);
});
