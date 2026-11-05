import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { Client } from 'pg';
import { randomBytes } from 'node:crypto';
import { checkDeployment } from './deployment-readiness.mjs';
import { successfulExecution } from '../../load-tests/lib/execution-result.js';

// Only called by container-topology with a generated disposable project/database.
export async function verifyTopologyDurability({ args, env, base, databaseUrl, project }) {
  assert.match(project, /^coderank_ci_[a-f0-9]{12}$/);
  assert.equal(env.CODERANK_POSTGRES_VOLUME, `${project}_postgres`);
  assert.equal(env.CODERANK_REDIS_VOLUME, `${project}_redis`);
  assert.match(env.ROLLBACK_SOURCE_SHA || '', /^[a-f0-9]{40}$/);
  const docker = (extra, overrides = {}) => execFileSync('docker', [...args, ...extra], {
    env: { ...env, ...overrides }, encoding: 'utf8', timeout: 120000,
  });
  const query = async (sql, values = []) => {
    const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
    try { await client.connect(); return (await client.query(sql, values)).rows; }
    finally { await client.end(); }
  };
  const ready = async () => {
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      try { const result = await checkDeployment(base); if (result.status === 'healthy') return; } catch {}
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw Error('Durability drill failed to restore full readiness');
  };
  const identities = () => Object.fromEntries(['postgres', 'redis', 'api', 'web', 'worker', 'gateway'].map(service => {
    const id = docker(['ps', '-q', service]).trim();
    assert.ok(id, `Missing ${service} container`);
    const data = JSON.parse(execFileSync('docker', ['inspect', id], { encoding: 'utf8' }))[0];
    const socket = data.Mounts.filter(mount => mount.Destination === '/var/run/docker.sock');
    assert.equal(socket.length, service === 'worker' ? 1 : 0, 'Only worker may mount Docker');
    return [service, { image: data.Image, volumes: data.Mounts.filter(mount => mount.Type === 'volume').map(mount => ({ name: mount.Name, destination: mount.Destination })) }];
  }));
  const before = identities();
  const sentinel = randomBytes(24).toString('hex');
  const redisKey = `ci:durability:${project}`;
  await query('CREATE TABLE ci_durability_sentinel (value text NOT NULL)');
  await query('INSERT INTO ci_durability_sentinel(value) VALUES($1)', [sentinel]);
  assert.equal(docker(['exec', '-T', 'redis', 'redis-cli', 'SET', redisKey, sentinel]).trim(), 'OK');
  const ledger = await query('SELECT name,checksum FROM coderank_migrations ORDER BY name');
  const unchanged = async () => {
    assert.equal((await query('SELECT value FROM ci_durability_sentinel'))[0].value, sentinel);
    assert.equal(docker(['exec', '-T', 'redis', 'redis-cli', 'GET', redisKey]).trim(), sentinel);
    assert.deepEqual(await query('SELECT name,checksum FROM coderank_migrations ORDER BY name'), ledger);
    const now = identities();
    for (const service of ['postgres', 'redis']) assert.deepEqual(now[service].volumes, before[service].volumes);
  };

  // Stop the real API while standard Next.js and the public gateway remain running.
  docker(['stop', 'api']);
  for (const path of ['/', '/login']) {
    const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(5000) });
    assert.equal(response.status, 200, 'Pages must remain available during API outage');
  }
  // The gateway owns a 10-second timeout; the client must allow that response.
  assert.ok([502, 503, 504].includes((await fetch(`${base}/api/live`, { signal: AbortSignal.timeout(15000) })).status));
  docker(['start', 'api']); await ready();

  // Restart actual durable services, then recreate applications without migrations or reseeding.
  docker(['restart', 'postgres', 'redis']);
  docker(['up', '-d', '--no-build', '--wait', 'postgres', 'redis']);
  await ready(); await unchanged();
  docker(['kill', '--signal', 'SIGKILL', 'postgres', 'redis']);
  docker(['up', '-d', '--no-build', '--wait', 'postgres', 'redis']);
  await ready(); await unchanged();
  docker(['up', '-d', '--no-build', '--force-recreate', 'api', 'web', 'worker', 'gateway']);
  await ready(); await unchanged();

  // Exercise an actual older API artifact, preserving the same database/Redis volumes.
  docker(['up', '-d', '--no-build', '--force-recreate', 'api'], { CODERANK_API_IMAGE: 'coderank-api:rollback' });
  await ready(); await unchanged();
  const rolledBack = identities();
  assert.notEqual(rolledBack.api.image, before.api.image, 'Rollback must use a distinct prior artifact');
  const previousSource = execFileSync('docker', ['image', 'inspect', '--format', '{{index .Config.Labels "org.opencontainers.image.revision"}}', 'coderank-api:rollback'], { encoding: 'utf8' }).trim();
  assert.equal(previousSource, env.ROLLBACK_SOURCE_SHA);
  docker(['up', '-d', '--no-build', '--force-recreate', 'api']); await ready(); await unchanged();
  assert.equal(identities().api.image, before.api.image);

  // Prove the restarted queue/API/worker still execute real code, not only health probes.
  const response = await fetch(`${base}/api/execute`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ language: 'python', code: "print('durability-recovery')" }), signal: AbortSignal.timeout(10000),
  });
  assert.equal(response.status, 202);
  const job = await response.json();
  const cookie = response.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie);
  let completed;
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    const result = await fetch(`${base}/api/jobs/${job.jobId}`, { headers: { cookie }, signal: AbortSignal.timeout(5000) });
    assert.equal(result.status, 200); const value = await result.json();
    assert.notEqual(value.status, 'failed');
    if (value.status === 'completed') { completed = value; break; }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(successfulExecution(completed, 'durability-recovery'));
  return { apiOutageWebAvailable: true, serviceRestart: true, dependencyCrashRecovery: true, volumeContinuity: true,
    applicationRollback: true, executionAfterRecovery: true, workerOnlyDocker: true,
    priorSource: previousSource, priorApiImage: rolledBack.api.image, currentImages: before };
}
