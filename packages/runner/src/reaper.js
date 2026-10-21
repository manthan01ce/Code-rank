import { performance } from 'node:perf_hooks';
import { dockerCommand } from './docker.js';
import { SANDBOX_PREFIX as PREFIX, SANDBOX_VERSION, sandboxScope } from './sandbox-metadata.js';

const UUID = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const NAME = new RegExp(`^/coderank-job-${UUID}$`);
const OWNER = new RegExp(`^${UUID}$`);
const ID = /^[a-f0-9]{64}$/;

export function expiredOwnedSandbox(container, { scope, now, graceMs }) {
  const labels = container?.Config?.Labels;
  if (!labels || labels['coderank.sandbox'] !== 'true' || labels[`${PREFIX}version`] !== SANDBOX_VERSION || labels[`${PREFIX}scope`] !== scope) return false;
  if (!ID.test(container.Id || '') || !NAME.test(container.Name || '') || !OWNER.test(labels[`${PREFIX}owner`] || '')) return false;
  const createdAt = Number(labels[`${PREFIX}created_at`]);
  const expiresAt = Number(labels[`${PREFIX}expires_at`]);
  const lifetime = Number(labels[`${PREFIX}lifetime_ms`]);
  const dockerCreatedAt = Date.parse(container.Created);
  const dockerStartedAt = Date.parse(container.State?.StartedAt);
  if (![createdAt, expiresAt, lifetime, dockerCreatedAt].every(Number.isFinite) || createdAt <= 0 || lifetime < 1000 || lifetime > 120000) return false;
  if (container.State?.Running && !Number.isFinite(dockerStartedAt)) return false;
  const roundedLifetime = Math.ceil(lifetime / 1000) * 1000;
  if (expiresAt !== createdAt + roundedLifetime) return false;
  // A slow docker run must never make a legitimately running sandbox look old.
  // Use both Docker daemon timestamps and worker metadata, then allow a grace.
  const origin = Math.max(createdAt, dockerCreatedAt, Number.isFinite(dockerStartedAt) ? dockerStartedAt : dockerCreatedAt);
  return now >= Math.max(expiresAt, origin + roundedLifetime) + graceMs;
}

export async function reapExpiredSandboxes({ scope = sandboxScope(), runDocker = dockerCommand, now = Date.now, graceMs = 5000, dryRun = false, limit = 100, cursor = 0 } = {}) {
  scope = sandboxScope(scope);
  if (!Number.isFinite(graceMs) || graceMs < 0 || graceMs > 60000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 1000 || !Number.isSafeInteger(cursor) || cursor < 0) throw new Error('Invalid sandbox reaper limits');
  const report = { scope, inspected: 0, removed: [], expired: [], retained: [], errors: [], nextCursor: cursor, candidates: 0, dryRun };
  const started = performance.now();
  const { stdout } = await runDocker(['ps', '-a', '-q', '--no-trunc', '--filter', 'label=coderank.sandbox=true', '--filter', `label=${PREFIX}version=${SANDBOX_VERSION}`, '--filter', `label=${PREFIX}scope=${scope}`], { timeout: 3000 });
  const ids = [...new Set(stdout.trim().split(/\s+/).filter(id => ID.test(id)))].sort();
  report.candidates = ids.length;
  if (!ids.length) { report.nextCursor = 0; return report; }
  for (let index = 0; index < Math.min(limit, ids.length); index++) {
    if (performance.now() - started > 10000) break;
    const id = ids[(cursor + index) % ids.length];
    report.nextCursor = (cursor + index + 1) % ids.length;
    report.inspected++;
    try {
      const inspected = await runDocker(['inspect', '--type', 'container', id], { timeout: 3000 });
      const containers = JSON.parse(inspected.stdout);
      const container = Array.isArray(containers) && containers.length === 1 ? containers[0] : null;
      if (container?.Id !== id || !expiredOwnedSandbox(container, { scope, now: now(), graceMs })) { report.retained.push(id); continue; }
      // Immutable ID prevents a same-name replacement being removed after inspect.
      report.expired.push(id);
      if (!dryRun) {
        await runDocker(['rm', '-f', id], { timeout: 3000 });
        report.removed.push(id);
      }
    } catch (error) {
      // Auto-remove can race inspection/removal; tolerate only a confirmed missing ID.
      if (!/No such (?:object|container)/i.test(error.stderr || '')) report.errors.push({ id, message: error.message });
    }
  }
  return report;
}

export function startSandboxReaper({ intervalMs = 30000, log = console, ...options } = {}) {
  if (!Number.isFinite(intervalMs) || intervalMs < 1000 || intervalMs > 120000) throw new Error('Invalid sandbox reaper interval');
  let pending, stopping, stopped = false, cursor = 0;
  const refresh = () => {
    if (stopped) return Promise.resolve();
    return pending ||= reapExpiredSandboxes({ ...options, cursor })
      .then(report => { cursor = report.nextCursor; if (report.removed.length || report.errors.length) log.info('Sandbox recovery:', report); return report; })
      .catch(error => { log.error('Sandbox recovery failed:', error.message); })
      .finally(() => { pending = null; });
  };
  const timer = setInterval(refresh, intervalMs); timer.unref();
  void refresh();
  return { refresh, stop: () => stopping ||= (async () => { stopped = true; clearInterval(timer); await pending; })() };
}
