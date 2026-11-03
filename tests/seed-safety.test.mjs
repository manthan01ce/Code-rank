import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

for (const args of [[], ['--force'], ['--allow-destructive-reset', '--unexpected']]) {
  test('seed refuses unacknowledged or ambiguous destructive reset: ' + JSON.stringify(args), () => {
    const script = fileURLToPath(new URL('../database/seed.js', import.meta.url));
    const result = spawnSync(process.execPath, [script, ...args], {
      env: { ...process.env, DATABASE_URL: 'postgresql://invalid:invalid@127.0.0.1:1/disposable' },
      encoding: 'utf8', timeout: 5000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Refusing destructive database reset/);
    assert.match(result.stderr, /--allow-destructive-reset/);
    assert.doesNotMatch(result.stderr, /ERR_MODULE_NOT_FOUND|ECONNREFUSED|Seeding database/);
    assert.equal(result.stdout, '');
  });
}
