import pg from 'pg';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, chmod, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { migrate } from '../../packages/database/src/migrations.js';
import { createPostgresClient } from '../../packages/database/src/postgres.js';

const exec = promisify(execFile);
const quote = value => '"' + value.replaceAll('"', '""') + '"';
export function databaseIdentity(value) {
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.pathname.slice(1)) throw Error('A PostgreSQL database URL is required');
  return `${url.hostname}:${url.port || 5432}/${decodeURIComponent(url.pathname.slice(1))}`;
}
export function databaseCommandEnvironment(value) {
  const url = new URL(value);
  databaseIdentity(value);
  const env = { ...process.env };
  // No URL/password appears in argv, diagnostics, or evidence files. Remove
  // inherited libpq overrides so tools operate on the exact requested target.
  for (const key of Object.keys(env)) if (key.startsWith('PG')) delete env[key];
  Object.assign(env, { PGHOST: url.hostname, PGPORT: url.port || '5432', PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGCONNECT_TIMEOUT: '10',
    PGSSLMODE: url.searchParams.get('sslmode') || (['localhost', '127.0.0.1'].includes(url.hostname) ? 'prefer' : 'require') });
  return env;
}
export function validateRestoreTarget(value) {
  const url = new URL(value);
  databaseIdentity(value);
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || !decodeURIComponent(url.pathname).endsWith('_test')) throw Error('Restore verification requires a loopback *_test administrator database');
  return url;
}
async function hashFile(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
async function inventory(query) {
  const { rows } = await query("SELECT c.relname name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND NOT c.relispartition ORDER BY c.relname");
  const counts = {};
  for (const { name } of rows) counts[name] = (await query(`SELECT count(*)::text count FROM public.${quote(name)}`)).rows[0].count;
  return counts;
}
async function applyMigrations(url) {
  const sql = createPostgresClient(url, { poolSize: 1, timeoutMs: 120000 });
  try {
    return await migrate({ query: sql.query, apply: migration => sql.transaction(tx => [
      tx.query('SELECT pg_advisory_xact_lock(20401017,1)'), ...migration.statements.map(text => tx.query(text)),
      tx.query('INSERT INTO coderank_migrations(name,checksum) VALUES($1,$2)', [migration.name, migration.checksum]),
    ]) }, new URL('../../database/migrations/', import.meta.url));
  } finally { await sql.close(); }
}

export async function runDatabaseOperations({ databaseUrl, restoreAdminUrl, target, output, mode = 'verify', maintenanceConfirmed = false }, {
  Pool = pg.Pool, command = (tool, args, env) => exec(tool, args, { env, timeout: 1800000, maxBuffer: 1048576 }),
  migrateDatabase = applyMigrations,
} = {}) {
  if (!['verify', 'migrate'].includes(mode)) throw Error('Mode must be verify or migrate');
  if (target !== databaseIdentity(databaseUrl)) throw Error('Explicit --target must match host:port/database');
  if (new URL(databaseUrl).hostname.includes('-pooler')) throw Error('A direct PostgreSQL connection is required; transaction poolers cannot hold snapshot/session locks');
  if (mode === 'migrate' && !maintenanceConfirmed) throw Error('Migration requires --maintenance-confirmed after writers are stopped');
  const adminUrl = validateRestoreTarget(restoreAdminUrl);
  if (databaseIdentity(databaseUrl) === databaseIdentity(adminUrl)) throw Error('Production and restore administrator targets must differ');
  if (!output) throw Error('An explicit evidence output directory is required');
  await mkdir(output, { recursive: false, mode: 0o700 });
  await chmod(output, 0o700);
  const archive = path.resolve(output, 'backup.dump'), manifest = path.resolve(output, 'manifest.json');
  const report = { version: 1, target, mode, startedAt: new Date().toISOString(), status: 'started', archive: 'backup.dump', verificationScope: 'Custom archive checksum, full transactional restore, public-table snapshot row counts, and migration rehearsal' };
  const save = async () => writeFile(manifest, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  await save();
  const source = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 10000, statement_timeout: 120000 });
  const admin = new Pool({ connectionString: adminUrl.href, max: 1, connectionTimeoutMillis: 10000, statement_timeout: 120000 });
  for (const pool of [source, admin]) pool.on('error', () => {});
  const cloneName = `coderank_restore_${randomBytes(12).toString('hex')}`;
  const cloneUrl = new URL(adminUrl); cloneUrl.pathname = '/' + cloneName;
  report.restoreTarget = databaseIdentity(cloneUrl.href);
  let connection, clone, created = false, snapshot = false, stage = 'preflight';
  try {
    connection = await source.connect();
    const locked = await connection.query('SELECT pg_try_advisory_lock(20401017,10) locked');
    if (!locked.rows[0].locked) throw Error('Database operation already running');
    const version = Number((await connection.query("SELECT current_setting('server_version_num') version")).rows[0].version);
    const versions = await Promise.all(['pg_dump', 'pg_restore'].map(async tool => {
      const binary = tool === 'pg_dump' ? process.env.PG_DUMP_BIN || tool : process.env.PG_RESTORE_BIN || tool;
      const { stdout } = await command(binary, ['--version'], databaseCommandEnvironment(databaseUrl));
      const match = stdout.match(/\(PostgreSQL\) (\d+)/);
      if (!match) throw Error('PostgreSQL tool version unavailable');
      return Number(match[1]);
    }));
    if (versions[0] < Math.floor(version / 10000) || versions[0] !== versions[1]) throw Error('Compatible pg_dump and pg_restore versions required');
    stage = 'backup';
    await connection.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); snapshot = true;
    const snapshotId = (await connection.query('SELECT pg_export_snapshot() snapshot')).rows[0].snapshot;
    report.tables = await inventory(connection.query.bind(connection));
    await writeFile(archive, '', { mode: 0o600 });
    await command(process.env.PG_DUMP_BIN || 'pg_dump', ['--format=custom', '--no-owner', '--no-acl', '--snapshot', snapshotId, '--file', archive], databaseCommandEnvironment(databaseUrl));
    await chmod(archive, 0o600);
    if ((await stat(archive)).size < 1) throw Error('Backup archive is empty');
    report.sha256 = await hashFile(archive);
    const toc = await command(process.env.PG_RESTORE_BIN || 'pg_restore', ['--list', archive], databaseCommandEnvironment(databaseUrl));
    if (!toc.stdout.trim()) throw Error('Backup archive has no table of contents');
    await connection.query('COMMIT'); snapshot = false;
    report.status = 'backup-created'; await save();
    stage = 'restore-verification';
    await admin.query(`CREATE DATABASE ${quote(cloneName)}`); created = true;
    await command(process.env.PG_RESTORE_BIN || 'pg_restore', ['--dbname', cloneName, '--exit-on-error', '--single-transaction', '--no-owner', '--no-acl', archive], databaseCommandEnvironment(cloneUrl.href));
    clone = new Pool({ connectionString: cloneUrl.href, max: 1, connectionTimeoutMillis: 10000, statement_timeout: 120000 }); clone.on('error', () => {});
    const restored = await inventory(clone.query.bind(clone));
    if (JSON.stringify(restored) !== JSON.stringify(report.tables)) throw Error('Restored table inventory differs from backup snapshot');
    if (await hashFile(archive) !== report.sha256) throw Error('Backup archive changed during verification');
    report.restoreVerifiedAt = new Date().toISOString();
    stage = 'migration-rehearsal';
    report.rehearsedMigrations = await migrateDatabase(cloneUrl.href);
    report.status = 'verified'; await save();
    if (mode === 'migrate') {
      stage = 'production-migration'; report.status = 'migrating'; await save();
      report.appliedMigrations = await migrateDatabase(databaseUrl);
    }
    report.status = 'complete'; report.completedAt = new Date().toISOString(); await save();
    return report;
  } catch {
    report.status = 'failed'; report.failedStage = stage; await save();
    throw Error(`Database operation failed during ${stage}; inspect the private evidence manifest`);
  } finally {
    const failures = [];
    const clean = async work => { try { await work(); } catch (error) { failures.push(error); } };
    let discard;
    if (snapshot) try { await connection.query('ROLLBACK'); } catch (error) { discard = error; failures.push(error); }
    if (clone) await clean(() => clone.end());
    if (created) await clean(() => admin.query(`DROP DATABASE ${quote(cloneName)} WITH (FORCE)`));
    if (connection) {
      if (!discard) await clean(() => connection.query('SELECT pg_advisory_unlock(20401017,10)'));
      connection.release(discard);
    }
    await Promise.all([source, admin].map(pool => clean(() => pool.end())));
    if (failures.length) {
      report.status = 'failed'; report.failedStage = 'cleanup'; await save();
      throw Error('Database operation failed during cleanup; inspect the private evidence manifest');
    }
  }
}

export const operateDatabase = runDatabaseOperations;
