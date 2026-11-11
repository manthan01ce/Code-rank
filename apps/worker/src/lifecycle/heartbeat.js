import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { checkDockerHealth } from '@coderank/runner/health';

export const WORKER_REGISTRY = 'coderank:execution:workers';
export const WORKER_KEY_PREFIX = 'coderank:execution:worker:';

export function startExecutionHeartbeat(worker, {
  redis = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    commandTimeout: 2000,
  }),
  checkDocker = checkDockerHealth,
  now = Date.now,
  log = console,
  intervalMs = 10000,
  observe,
} = {}) {
  const id = randomUUID();
  const key = `${WORKER_KEY_PREFIX}${id}`;
  const ttlSeconds = 30;
  let stopped = false;
  let pending;
  let eventTimer;
  redis.on('error', error => log.error('Worker heartbeat Redis error:', error.message));

  function refresh() {
    if (stopped) return Promise.resolve();
    if (pending) return pending;
    pending = (async () => {
      try {
        const docker = await checkDocker();
        if (stopped) return;
        const telemetry = observe ? await observe() : {};
        if (stopped) return;
        const checkedAt = now();
        const healthy = docker.healthy === true && worker.isRunning() && !worker.isPaused();
        const record = { ...telemetry, id, healthy, checkedAt, image: process.env.RUNNER_IMAGE || 'coderank-base:latest', concurrency: worker.opts.concurrency };
        const replies = await redis.multi()
          .set(key, JSON.stringify(record), 'EX', observe ? 120 : ttlSeconds)
          .zadd(WORKER_REGISTRY, checkedAt + ttlSeconds * 1000, id)
          .zremrangebyscore(WORKER_REGISTRY, '-inf', observe ? checkedAt - 90000 : checkedAt)
          .exec();
        if (!replies || replies.some(([error]) => error)) throw new Error('Heartbeat transaction failed');
        // Container startup can lag the active event. Keep sampling while jobs
        // run so a short execution is observable before its periodic idle lease.
        if (observe && telemetry.activeJobs > 0 && !stopped && !eventTimer) {
          eventTimer = setTimeout(() => { eventTimer = null; void refresh(); }, 2000);
          eventTimer.unref();
        }
      } catch (error) {
        // A failed publish is never refreshed as healthy: its old lease expires.
        log.error('Worker capability heartbeat failed:', error.message);
      }
    })().finally(() => { pending = null; });
    return pending;
  }

  function changed() {
    if (stopped || eventTimer) return;
    eventTimer = setTimeout(() => {
      eventTimer = null;
      if (pending) void pending.then(changed);
      else void refresh();
    }, 100);
    eventTimer.unref();
  }
  const observedEvents = ['active', 'completed', 'failed', 'paused', 'resumed'];
  if (observe) for (const event of observedEvents) worker.on(event, changed);
  const timer = setInterval(refresh, intervalMs);
  timer.unref();
  void refresh();
  let stopping;
  return {
    id, refresh,
    stop() {
      return stopping ||= (async () => {
        stopped = true;
        clearInterval(timer);
        clearTimeout(eventTimer);
        if (observe) for (const event of observedEvents) worker.off(event, changed);
        try {
          await pending;
          await redis.multi().del(key).zrem(WORKER_REGISTRY, id).exec();
        } catch (error) {
          log.error('Worker heartbeat removal failed; lease will expire:', error.message);
        } finally { redis.disconnect(); }
      })();
    },
  };
}
