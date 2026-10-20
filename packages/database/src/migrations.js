import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';

export async function loadMigrations(directory) {
  const files = (await readdir(directory)).filter(name => /^\d+.*\.sql$/.test(name)).sort();
  return Promise.all(files.map(async name => {
    const source = await readFile(new URL(name, directory), 'utf8');
    return { name, checksum: createHash('sha256').update(source).digest('hex'), statements: source.split(/^-- statement-breakpoint\s*$/m).map(s => s.trim()).filter(Boolean) };
  }));
}
export const LEDGER_SQL = 'CREATE TABLE IF NOT EXISTS coderank_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())';
export async function migrate(adapter, directory) {
  await adapter.query(LEDGER_SQL, []);
  const applied = [];
  for (const migration of await loadMigrations(directory)) {
    const rows = await adapter.query('SELECT checksum FROM coderank_migrations WHERE name = $1', [migration.name]);
    if (rows.length) {
      if (rows[0].checksum !== migration.checksum) throw new Error(`Applied migration changed: ${migration.name}`);
      continue;
    }
    try { await adapter.apply(migration); }
    catch (error) {
      // Only a duplicate ledger insert can represent a concurrent migrator.
      // Preserve the original SQL failure even if reconciliation is unavailable.
      if (error.code !== '23505') throw error;
      let current;
      try { current = await adapter.query('SELECT checksum FROM coderank_migrations WHERE name = $1', [migration.name]); }
      catch { throw error; }
      if (current[0]?.checksum !== migration.checksum) throw error;
    }

    applied.push(migration.name);
  }
  return applied;
}
