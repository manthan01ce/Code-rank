import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
test('lab supervisor rejects invalid replica counts and colliding listener ports before startup', () => {
  for (const [env, message] of [
    [{ CLUSTER_ENABLED: 'true', WEB_CONCURRENCY: '100' }, 'WEB_CONCURRENCY must be'],
    [{ PORT: '3000', API_PORT: '3001', WEB_INTERNAL_PORT: '3000' }, 'WEB_INTERNAL_PORT range'],
  ]) {
    const result = spawnSync(process.execPath, ['scripts/dev/web-runtime.mjs'], { cwd: new URL('../../', import.meta.url), env: { ...process.env, ...env }, encoding: 'utf8', timeout: 5000 });
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr.includes(message), result.stderr);
  }
});
