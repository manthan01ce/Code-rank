import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { migrationDirectory, bootstrapSQL } from '../../packages/database/src/assets.js';
import { loadMigrations } from '../../packages/database/src/migrations.js';
import expected from '../../packages/database/sql-assets.sha256.json' with { type: 'json' };
import required from '../../packages/database/src/required-migrations.json' with { type: 'json' };

test('relocated SQL preserves every original name, raw byte checksum and ledger manifest', async () => {
  assert.equal(expected.length, 10);
  for (const entry of expected) {
    const bytes = await readFile(new URL('../../' + entry.destination, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, entry.original);
    assert.equal(entry.original.split('/').at(-1), entry.destination.split('/').at(-1));
  }
  const actualNames = (await readdir(migrationDirectory)).filter(n => n.endsWith('.sql')).sort();
  assert.deepEqual(actualNames, expected.filter(e => e.original.includes('/migrations/')).map(e => e.original.split('/').at(-1)).sort());
  assert.deepEqual((await loadMigrations(migrationDirectory)).map(({ name, checksum }) => ({ name, checksum })), required);
  assert.ok((await readFile(bootstrapSQL)).length > 0);
});

test('database assets and manifest generation resolve outside repository cwd; seed still refuses', () => {
  const assets = new URL('../../packages/database/src/assets.js', import.meta.url).href;
  const migrations = new URL('../../packages/database/src/migrations.js', import.meta.url).href;
  const code = `const {migrationDirectory}=await import(${JSON.stringify(assets)});const {loadMigrations}=await import(${JSON.stringify(migrations)});if((await loadMigrations()).length!==9)throw Error('Missing migrations');`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: tmpdir(), encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 0, result.stderr);
  const seed = fileURLToPath(new URL('../../packages/database/seeds/seed.js', import.meta.url));
  const refusal = spawnSync(process.execPath, [seed], { cwd: tmpdir(), env: { ...process.env, DATABASE_URL: 'postgresql://invalid@127.0.0.1:1/disposable' }, encoding: 'utf8', timeout: 5000 });
  assert.equal(refusal.status, 1);
  assert.match(refusal.stderr, /Refusing destructive database reset/);
});
