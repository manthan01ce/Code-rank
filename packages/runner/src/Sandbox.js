import { randomUUID } from 'node:crypto';
import { dockerCommand } from './docker.js';
import { SANDBOX_OWNER, SANDBOX_VERSION, SANDBOX_PREFIX, sandboxScope } from './sandbox-metadata.js';
export { reapExpiredSandboxes, startSandboxReaper } from './reaper.js';

export function jobLifetime(value = process.env.JOB_TIMEOUT_MS) {
  const duration = Number(value ?? 30000);
  return Number.isFinite(duration) && duration > 0 ? Math.min(120000, Math.max(1000, duration)) : 30000;
}

export class Sandbox {
  constructor(runDocker = dockerCommand, { scope = sandboxScope() } = {}) {
    this.runDocker = runDocker;
    this.name = `coderank-job-${randomUUID()}`;
    this.lifetime = jobLifetime();
    this.deadline = Date.now() + this.lifetime;
    this.destroyed = false;
    this.scope = sandboxScope(scope);
  }
  async start() {
    if (this.destroyed) throw new Error('Sandbox is closed');
    const createdAt = Date.now();
    if (!this.starting) this.starting = this.runDocker([
      'run', '-d', '--rm', '--name', this.name, '--label', 'coderank.sandbox=true',
      '--label', `${SANDBOX_PREFIX}version=${SANDBOX_VERSION}`,
      '--label', `${SANDBOX_PREFIX}scope=${this.scope}`,
      '--label', `${SANDBOX_PREFIX}owner=${SANDBOX_OWNER}`,
      '--label', `${SANDBOX_PREFIX}created_at=${createdAt}`,
      '--label', `${SANDBOX_PREFIX}expires_at=${createdAt + Math.ceil(this.lifetime / 1000) * 1000}`,
      '--label', `${SANDBOX_PREFIX}lifetime_ms=${this.lifetime}`,
      '--network', 'none', '--read-only', '--cap-drop', 'ALL',
      '--security-opt', 'no-new-privileges:true', '--user', '0:0', '--init',
      '--pids-limit', '64', '--memory', '512m', '--memory-swap', '512m', '--cpus', '1',
      '--tmpfs', '/app:rw,exec,nosuid,nodev,size=128m,uid=1000,gid=1000,mode=0700',
      '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=64m,uid=1000,gid=1000,mode=0700',
      process.env.RUNNER_IMAGE || 'coderank-base:latest',
      // Root supervisor has no capabilities and cannot be signalled by UID 1000.
      // Submitted code always uses the explicit non-root docker exec identity.
      // Container lifetime is bounded even if the worker crashes or is killed.
      'sleep', String(Math.ceil(this.lifetime / 1000)),
    ], { timeout: 10000 });
    try { await this.starting; } catch (error) { error.infrastructure = true; throw error; }
  }
  async script(input, budget) {
    await this.start();
    const remaining = Math.min(Number.isFinite(budget) && budget > 0 ? budget : this.lifetime, this.deadline - Date.now());
    if (remaining <= 0) { await this.destroy(); throw Object.assign(new Error('Job deadline exceeded'), { code: 124 }); }
    try {
      return await this.runDocker(['exec', '--user', '1000:1000', '-i', this.name, 'timeout', '-k', '1s', `${(remaining / 1000).toFixed(3)}s`, 'bash', '-s'], { input, timeout: remaining + 2000 });
    } catch (error) {
      // Kill the whole container on timeout/output overflow, including detached children.
      if (error.killed || error.code === 124 || error.code === 137 || error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') await this.destroy();
      throw error;
    }
  }
  async destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (!this.starting) return;
    await this.starting.catch(() => {});
    await this.runDocker(['rm', '-f', this.name], { timeout: 3000 }).catch(() => {
      console.warn('Sandbox removal failed; container lifetime remains bounded', { sandbox: this.name });
    });
  }
}
