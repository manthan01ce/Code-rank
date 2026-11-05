import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = fileURLToPath(new URL('../../', import.meta.url));
const read = name => readFileSync(resolve(root, name), 'utf8');
const exists = name => assert.ok(existsSync(resolve(root, name)), name);
const modes = {
  smoke: 'smoke-test.js', 'smoke-100': 'smoke-test-100vu.js', stress: 'stress-test.js',
  api: 'api-load-test.js', execution: 'execution-stress-test.js', websocket: 'websocket-polling-test.js',
  ratelimit: 'rate-limit-test.js', submission: 'submission-load-test.js', max: 'max-users-test.js',
};

test('public npm load commands retain arguments and point at existing owners', () => {
  const scripts = JSON.parse(read('package.json')).scripts;
  const expected = {};
  for (const mode of ['smoke', 'api', 'execution', 'all']) expected[`k6:${mode}`] = 'powershell -ExecutionPolicy Bypass -File ./load-tests/run-k6.ps1 -Test '+mode;
  for (const mode of ['smoke-100', 'stress']) expected[`k6:${mode}`] = `k6 run -e BASE_URL=http://localhost:3000 ./load-tests/scenarios/${modes[mode]}`;
  for (const mode of ['smoke', 'api', 'run', 'submission', 'concurrency']) expected[`k6:qualify:${mode}`] = `k6 run -e MODE=${mode} load-tests/scenarios/qualification.js`;
  assert.deepEqual(Object.keys(scripts).filter(name => name.startsWith('k6:')).sort(), Object.keys(expected).sort());
  for (const [name, command] of Object.entries(expected)) assert.equal(scripts[name], command, name);
  for (const name of Object.values(modes)) exists(`load-tests/scenarios/${name}`);
  exists('load-tests/run-k6.ps1'); exists('load-tests/scenarios/qualification.js');
  assert.equal(scripts['test:capacity'], 'node load-tests/scripts/capacity.mjs'); exists('load-tests/scripts/capacity.mjs');
});

test('PowerShell dispatch selects the intended scenarios and helper roots', () => {
  const source = read('load-tests/run-k6.ps1');
  assert.equal(source.charCodeAt(0), 0xfeff, 'Windows PowerShell 5 must decode Unicode names as UTF-8');
  assert.ok(source.includes('Join-Path (Join-Path $scriptDir "scenarios") $ScriptFile'));
  // Check this runner's literal switch/ScriptFile convention, not arbitrary shell syntax.
  const blocks = [...source.matchAll(/^    "([\w-]+)" \{([\s\S]*?)(?=^    "[\w-]+" \{|^\}$)/gm)];
  assert.deepEqual(blocks.map(m => m[1]), [...Object.keys(modes), 'all']);
  for (const [, mode, body] of blocks) {
    const files = [...body.matchAll(/-ScriptFile "([\w.-]+\.js)"/g)].map(m => m[1]);
    assert.deepEqual(files, mode === 'all' ? ['smoke', 'api', 'execution', 'websocket', 'submission'].map(m => modes[m]) : [modes[mode]], mode);
  }
  for (const [helper, file] of [['test-smoke', 'smoke-test.js'], ['test-api', 'api-load-test.js']]) {
    assert.ok(read(`load-tests/scripts/${helper}.ps1`).includes(`Join-Path $PSScriptRoot "../scenarios/${file}"`));
  }
  const full = read('load-tests/scripts/run-full-suite.ps1');
  assert.ok(full.includes('Join-Path $SCRIPT_DIR "scenarios/$Script"'));
  assert.ok(full.includes('Join-Path $PSScriptRoot $Script'));
  for (const [, file] of full.matchAll(/-Script "([\w.-]+\.js)"/g)) exists(`load-tests/${file === 'runner-concurrency-benchmark.js' ? 'scripts' : 'scenarios'}/${file}`);
  const all = read('load-tests/scripts/run-all-tests.ps1');
  assert.ok(all.includes('$loadTestDir = Split-Path -Parent $PSScriptRoot'));
  assert.ok(all.includes('Join-Path $loadTestDir "run-k6.ps1"'));
  assert.ok(all.includes('& $runner -Test $test.Script'));
  for (const [, mode] of all.matchAll(/Script = "([\w-]+)"/g)) assert.ok(modes[mode], mode);
});

test('diagnostic and profiling executable literals resolve without starting applications', () => {
  for (const file of ['load-tests/scripts/run-local-diagnostic.mjs', 'scripts/dev/profile-local-pages.mjs', 'scripts/dev/profile-auth-components.mjs']) {
    const source = read(file);
    for (const [, reference] of source.matchAll(/['"]((?:apps|scripts|load-tests)\/[\w/.-]+\.(?:js|mjs))['"]/g)) exists(reference);
    const result = spawnSync(process.execPath, ['--check', resolve(root, file)], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  const source = read('load-tests/scripts/run-local-diagnostic.mjs');
  assert.ok(source.includes("['apps/api/src/server.js']"));
  assert.ok(source.includes("['scripts/dev/web-runtime.mjs']"));
});

test('current load-test guide executable references resolve in their documented directory', () => {
  for (const file of readdirSync(resolve(root, 'load-tests')).filter(name => name.endsWith('.md'))) {
    const source = read(`load-tests/${file}`);
    for (const [, block] of source.matchAll(/```[^\n]*\n([\s\S]*?)```/g)) {
      for (const [, path] of block.matchAll(/\b(load-tests[\\/][\w./\\-]+\.(?:js|mjs|ps1))\b/g)) exists(path.replaceAll('\\', '/'));
      for (const line of block.split('\n').filter(line => /^k6 run\b/.test(line))) {
        for (const [, file] of line.matchAll(/(?:^|\s)([\w./-]+\.js)\b/g)) exists(file.startsWith('load-tests/') ? file : `load-tests/${file}`);
      }
      for (const [, helper] of block.matchAll(/\.\\(scripts\\[\w-]+\.ps1)/g)) exists(`load-tests/${helper.replaceAll('\\', '/')}`);
      assert.doesNotMatch(block, /\.\\(?:test-smoke|test-api)\.ps1\b/);
    }
  }
});
