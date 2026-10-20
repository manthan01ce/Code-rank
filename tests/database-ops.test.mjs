import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { runDatabaseOperations, databaseIdentity, databaseCommandEnvironment, validateRestoreTarget } from '../scripts/lib/database-ops.mjs';

const source = 'postgresql://owner:private-password@127.0.0.1:5432/source_test';
const admin = 'postgresql://restore:other-private-password@127.0.0.1:5432/restore_test';
function fixture({ mismatch = false, restoreFails = false, rehearsalFails = false } = {}) {
  const commands = [], queries = [], migrations = [], pools = [];
  class Pool {
    constructor({ connectionString }) { this.url = connectionString; this.clone = new URL(connectionString).pathname.startsWith('/coderank_restore_'); pools.push(this); }
    on() {}
    async connect() { return { query: this.query.bind(this), release: () => { this.released = true; } }; }
    async query(text) {
      queries.push({ url: this.url, text });
      if (text.includes('pg_try_advisory_lock')) return { rows: [{ locked: true }] };
      if (text.includes('server_version_num')) return { rows: [{ version: '160012' }] };
      if (text.includes('pg_export_snapshot')) return { rows: [{ snapshot: '00000003-0000001A-1' }] };
      if (text.includes('FROM pg_class')) return { rows: [{ name: 'practical_submissions' }, { name: 'users' }] };
      if (text.includes('count(*)')) return { rows: [{ count: this.clone && mismatch ? '3' : '2' }] };
      return { rows: [] };
    }
    async end() { this.ended = true; }
  }
  return {
    commands, queries, migrations, pools,
    dependencies: {
      Pool,
      command: async (tool, args, env) => {
        commands.push({ tool, args, env });
        if (args.includes('--version')) return { stdout: `${tool} (PostgreSQL) 16.12` };
        if (args.includes('--file')) { await writeFile(args[args.indexOf('--file') + 1], 'verified backup fixture'); return { stdout: '' }; }
        if (args.includes('--list')) return { stdout: '; archive table of contents\nTABLE public users\n' };
        assert.ok(args.includes('--dbname'), 'restore must connect, not emit SQL');
        assert.match(args[args.indexOf('--dbname') + 1], /^coderank_restore_[0-9a-f]{24}$/);
        assert.equal(env.PGDATABASE, args[args.indexOf('--dbname') + 1]);
        if (restoreFails) throw new Error('private-password database error');
        return { stdout: '' };
      },
      migrateDatabase: async url => { migrations.push(url); if (rehearsalFails) throw new Error('bad migration'); return []; },
    },
  };
}
async function withOutput(run) {
  const directory = await mkdtemp(path.join(process.cwd(), '.database-ops-test-'));
  try { await run(path.join(directory, 'evidence')); } finally { await rm(directory, { recursive: true, force: true }); }
}
const options = output => ({ databaseUrl: source, restoreAdminUrl: admin, target: databaseIdentity(source), output });

test('database operations restore and rehearse before any source migration, preserving private evidence', () => withOutput(async output => {
  const f = fixture();
  const report = await runDatabaseOperations({ ...options(output), mode: 'migrate', maintenanceConfirmed: true }, f.dependencies);
  assert.equal(report.status, 'complete');
  assert.equal(f.migrations.length, 2);
  assert.match(new URL(f.migrations[0]).pathname, /^\/coderank_restore_/);
  assert.equal(f.migrations[1], source);
  assert.equal(report.tables.practical_submissions, '2');
  assert.match(report.sha256, /^[0-9a-f]{64}$/);
  assert.ok(f.queries.some(query => query.text.startsWith('DROP DATABASE "coderank_restore_')));
  assert.ok(f.pools.every(pool => pool.ended));
  assert.equal((await stat(path.join(output, 'backup.dump'))).mode & 0o777, 0o600);
  assert.equal((await stat(output)).mode & 0o777, 0o700);
  const evidence = await readFile(path.join(output, 'manifest.json'), 'utf8');
  assert.ok(!evidence.includes('private-password'));
  for (const { args } of f.commands) assert.ok(!JSON.stringify(args).includes('private-password'));
}));

test('verify mode never migrates the source and restore mismatches prevent all migrations', () => withOutput(async output => {
  const f = fixture();
  await runDatabaseOperations(options(output), f.dependencies);
  assert.equal(f.migrations.length, 1);
  assert.notEqual(f.migrations[0], source);
  const bad = fixture({ mismatch: true });
  await assert.rejects(runDatabaseOperations({ ...options(output + '-mismatch'), mode: 'migrate', maintenanceConfirmed: true }, bad.dependencies), /restore-verification/);
  assert.deepEqual(bad.migrations, []);
  await rm(output + '-mismatch', { recursive: true, force: true });
}));

test('restore or rehearsal failures clean disposable databases and block source writes', () => withOutput(async output => {
  for (const [index, failure] of [{ restoreFails: true }, { rehearsalFails: true }].entries()) {
    const f = fixture(failure), directory = output + index;
    await assert.rejects(runDatabaseOperations({ ...options(directory), mode: 'migrate', maintenanceConfirmed: true }, f.dependencies), error => !error.message.includes('private-password'));
    assert.ok(!f.migrations.includes(source));
    assert.ok(f.queries.some(query => query.text.startsWith('DROP DATABASE')));
    assert.ok(f.pools.every(pool => pool.ended));
    assert.equal(JSON.parse(await readFile(path.join(directory, 'manifest.json'))).status, 'failed');
    await rm(directory, { recursive: true, force: true });
  }
}));

test('explicit target, maintenance gate, direct connection, and isolated restore target are mandatory', async () => {
  const f = fixture();
  await assert.rejects(runDatabaseOperations({ ...options('unused'), target: 'wrong' }, f.dependencies), /target/);
  await assert.rejects(runDatabaseOperations({ ...options('unused'), mode: 'migrate' }, f.dependencies), /maintenance/);
  const pooled = source.replace('127.0.0.1', 'example-pooler.neon.tech');
  await assert.rejects(runDatabaseOperations({ ...options('unused'), databaseUrl: pooled, target: databaseIdentity(pooled) }, f.dependencies), /direct PostgreSQL/);
  assert.throws(() => validateRestoreTarget('postgresql://owner:password@production.example/restore_test'), /loopback/);
  assert.throws(() => validateRestoreTarget('postgresql://owner:password@localhost/live'), /loopback/);
  assert.equal(f.pools.length, 0);
});

test('libpq command environment has decoded credentials without leaking URLs into argv', () => {
  const env = databaseCommandEnvironment('postgresql://owner:p%40ss%3Aword@localhost:5433/source_test?sslmode=disable');
  assert.equal(env.PGPASSWORD, 'p@ss:word');
  assert.equal(env.PGPORT, '5433');
  assert.equal(env.PGDATABASE, 'source_test');
  assert.equal(env.PGSSLMODE, 'disable');
});
