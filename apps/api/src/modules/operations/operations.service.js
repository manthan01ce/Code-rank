import os from 'node:os';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import sql from '@coderank/database';
import { checkDatabaseReadiness } from '@coderank/database/readiness';
import { withTimeout } from '@coderank/core/shared/timeout';
import { SubmissionService } from '@coderank/core/submissions';

// In-memory cache for health checks
let healthCache = null;
let healthCacheTime = 0;
let refreshPromise = null;
const HEALTH_CACHE_TTL = 10000; // 10 seconds

// In-memory cache for detailed health
let detailedHealthCache = null;
let detailedHealthCacheTime = 0;
let refreshDetailedPromise = null;
const DETAILED_HEALTH_CACHE_TTL = 10000; // 10 seconds

// In-memory cache for queue stats
let queueStatsCache = null;
let queueStatsCacheTime = 0;
let refreshQueuePromise = null;
const QUEUE_STATS_CACHE_TTL = 5000; // 5 seconds

const DEFAULT_QUEUE_STATS = {
  waiting: 0,
  active: 0,
  completed: 0,
  failed: 0,
  delayed: 0,
};

// Observability state for HTTP metrics
const STATE_KEY = Symbol.for('coderank.api.observability');
const MAX_SAMPLES = 2048;

function createObservabilityState() {
  const eventLoop = monitorEventLoopDelay({ resolution: 20 });
  try {
    eventLoop.enable();
  } catch {
    // If already enabled or unsupported
  }
  return {
    startedAt: Date.now(),
    requests: 0,
    errors: 0,
    durations: [],
    endpoints: new Map(),
    eventLoop,
    lastCpu: process.cpuUsage(),
  };
}

const obsState = (globalThis[STATE_KEY] ||= createObservabilityState());

function routeName(url = '/') {
  return url
    .split('?')[0]
    .replace(/\/[0-9]+(?=\/|$)/g, '/:id')
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}(?=\/|$)/gi, '/:id');
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] * 100) / 100;
}

export class OperationsService {
  static resetCaches() {
    healthCache = null;
    healthCacheTime = 0;
    refreshPromise = null;
    detailedHealthCache = null;
    detailedHealthCacheTime = 0;
    refreshDetailedPromise = null;
    queueStatsCache = null;
    queueStatsCacheTime = 0;
    refreshQueuePromise = null;
  }

  static recordHttpRequest({ url, statusCode, durationMs }) {
    obsState.requests += 1;
    if (statusCode >= 500) obsState.errors += 1;
    obsState.durations.push(durationMs);
    if (obsState.durations.length > MAX_SAMPLES) {
      obsState.durations.splice(0, obsState.durations.length - MAX_SAMPLES);
    }

    const endpoint = routeName(url);
    const current = obsState.endpoints.get(endpoint) || { requests: 0, errors: 0, durations: [] };
    current.requests += 1;
    if (statusCode >= 500) current.errors += 1;
    current.durations.push(durationMs);
    if (current.durations.length > 256) current.durations.shift();
    if (obsState.endpoints.has(endpoint) || obsState.endpoints.size < 256) obsState.endpoints.set(endpoint, current);
  }

  static getHttpMetrics(admin) {
    if (!admin || admin.role !== 'admin') {
      throw { status: 401, message: 'Unauthorized' };
    }

    const elapsedSeconds = Math.max(1, (Date.now() - obsState.startedAt) / 1000);
    const cpu = process.cpuUsage(obsState.lastCpu);
    obsState.lastCpu = process.cpuUsage();
    const endpoints = [...obsState.endpoints.entries()]
      .map(([path, values]) => ({
        path,
        requests: values.requests,
        errors: values.errors,
        p95Ms: percentile(values.durations, 0.95),
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 20);

    return {
      uptimeSeconds: Math.round(process.uptime()),
      requests: obsState.requests,
      errors: obsState.errors,
      requestRatePerSecond: Math.round((obsState.requests / elapsedSeconds) * 100) / 100,
      latencyMs: {
        p50: percentile(obsState.durations, 0.5),
        p90: percentile(obsState.durations, 0.9),
        p95: percentile(obsState.durations, 0.95),
      },
      process: {
        memory: process.memoryUsage(),
        cpuUserMicrosSinceLastRead: cpu.user,
        cpuSystemMicrosSinceLastRead: cpu.system,
        eventLoopDelayMs: {
          p50: Math.round(obsState.eventLoop.percentile(50) / 1e4) / 100,
          p95: Math.round(obsState.eventLoop.percentile(95) / 1e4) / 100,
        },
      },
      endpoints,
    };
  }

  static async refreshHealthCache() {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
      try {
        const report = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          services: {
            database: { status: 'unknown' },
            queue: { status: 'unknown' },
            execution: { status: 'unknown' },
          },
        };

        const [dbResult, queueResult, workerResult] = await Promise.allSettled([
          withTimeout(checkDatabaseReadiness(sql.query), 3500),
          withTimeout(SubmissionService.getQueueStats(), 1200),
          withTimeout(SubmissionService.getWorkerStatus(), 1200),
        ]);

        if (dbResult.status === 'fulfilled' && dbResult.value?.healthy === true) {
          report.services.database = { status: 'healthy', schema: 'current' };
        } else {
          report.services.database.status = 'degraded';
          report.services.database.schema =
            dbResult.status === 'fulfilled' ? dbResult.value?.schema || 'unknown' : 'unknown';
          report.services.database.error =
            'Database unavailable or required migrations are missing or changed';
        }

        if (queueResult.status === 'fulfilled' && !queueResult.value?.cached) {
          report.services.queue.status = 'healthy';
          report.services.queue.stats = queueResult.value;
        } else if (queueResult.status === 'fulfilled') {
          report.services.queue.status = 'degraded';
          report.services.queue.stats = queueResult.value;
          report.services.queue.error =
            'Redis queue is unavailable; cached queue statistics are being returned';
        } else {
          report.services.queue.status = 'degraded';
          report.services.queue.error = 'Queue check failed';
        }

        report.services.execution =
          workerResult.status === 'fulfilled' && workerResult.value?.healthy
            ? { status: 'healthy', healthyWorkers: workerResult.value.healthyWorkers }
            : { status: 'degraded', healthyWorkers: 0 };

        report.status = Object.values(report.services).every((s) => s.status === 'healthy')
          ? 'healthy'
          : 'degraded';

        healthCache = report;
        healthCacheTime = Date.now();
        return report;
      } catch {
        healthCache = {
          status: 'degraded',
          timestamp: new Date().toISOString(),
          services: {
            database: { status: 'degraded', error: 'Health check failed' },
            queue: { status: 'degraded' },
            execution: { status: 'degraded' },
          },
        };
        healthCacheTime = Date.now();
        return healthCache;
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  }

  static async getHealth() {
    const isCacheDisabled = process.env.DISABLE_CACHE === 'true';
    const now = Date.now();
    const cacheAge = now - healthCacheTime;

    if (!isCacheDisabled && healthCache && cacheAge < HEALTH_CACHE_TTL) {
      return {
        data: healthCache,
        status: healthCache.status === 'healthy' ? 200 : 503,
        cacheHeader: 'HIT',
      };
    }

    await this.refreshHealthCache();

    return {
      data: healthCache,
      status: healthCache.status === 'healthy' ? 200 : 503,
      cacheHeader: isCacheDisabled ? 'DISABLED' : 'MISS',
    };
  }

  static async refreshDetailedHealth() {
    if (refreshDetailedPromise) return refreshDetailedPromise;

    refreshDetailedPromise = (async () => {
      try {
        const report = {
          timestamp: new Date().toISOString(),
          systemInfo: {
            nodeVersion: process.version,
            uptimeSeconds: Math.floor(process.uptime()),
            memoryUsage: process.memoryUsage(),
            cpuCount: os.cpus().length,
            platform: os.platform(),
            arch: os.arch(),
          },
          connectionPools: {
            database: {
              provider: process.env.DATABASE_DRIVER === 'neon' ? 'Neon PostgreSQL' : 'PostgreSQL',
              status: 'managed by database package',
              note: 'Readiness is reported by /api/health; this diagnostic does not run migrations',
            },
            redis: {
              status: 'managed by internal modules',
              isOpen: false,
              isReady: false,
              note: 'Redis health indicated by successful queue stats retrieval',
            },
          },
          circuitBreakers: {
            redis: {
              state: 'unknown',
              note: 'Circuit breaker state is internal to rateLimiter module',
            },
            database: {
              state: 'not implemented',
              note: 'Database uses timeout wrapper instead of circuit breaker',
            },
          },
          queueStats: {
            waiting: 0,
            active: 0,
            completed: 0,
            failed: 0,
            delayed: 0,
          },
        };

        try {
          const stats = await SubmissionService.getQueueStats();
          report.queueStats = stats;
        } catch {
          report.queueStats.error = 'Queue check failed';
        }

        detailedHealthCache = report;
        detailedHealthCacheTime = Date.now();
        return report;
      } catch {
        const errorReport = {
          timestamp: new Date().toISOString(),
          error: 'Failed to generate health report',
          message: 'Internal server error',
          systemInfo: {
            nodeVersion: process.version,
            uptimeSeconds: Math.floor(process.uptime()),
          },
        };
        detailedHealthCache = errorReport;
        detailedHealthCacheTime = Date.now();
        return errorReport;
      } finally {
        refreshDetailedPromise = null;
      }
    })();

    return refreshDetailedPromise;
  }

  static async getDetailedHealth(admin) {
    if (!admin || admin.role !== 'admin') {
      throw { status: 401, message: 'Unauthorized' };
    }

    const isCacheDisabled = process.env.DISABLE_CACHE === 'true';
    const now = Date.now();
    const cacheAge = now - detailedHealthCacheTime;

    if (!isCacheDisabled && detailedHealthCache && cacheAge < DETAILED_HEALTH_CACHE_TTL) {
      return {
        data: detailedHealthCache,
        cacheHeader: 'HIT',
      };
    }

    if (!isCacheDisabled && detailedHealthCache && cacheAge < DETAILED_HEALTH_CACHE_TTL * 2) {
      this.refreshDetailedHealth().catch(() => {});
      return {
        data: detailedHealthCache,
        cacheHeader: 'STALE',
      };
    }

    const report = await this.refreshDetailedHealth();
    return {
      data: report,
      cacheHeader: isCacheDisabled ? 'DISABLED' : 'MISS',
    };
  }

  static async refreshQueueStats() {
    if (refreshQueuePromise) return refreshQueuePromise;

    refreshQueuePromise = (async () => {
      try {
        const stats = await withTimeout(SubmissionService.getQueueStats(), 1000);
        queueStatsCache = stats || DEFAULT_QUEUE_STATS;
        queueStatsCacheTime = Date.now();
        return queueStatsCache;
      } catch {
        if (!queueStatsCache) {
          queueStatsCache = DEFAULT_QUEUE_STATS;
          queueStatsCacheTime = Date.now();
        }
        return queueStatsCache;
      } finally {
        refreshQueuePromise = null;
      }
    })();

    return refreshQueuePromise;
  }

  static async getQueueStats() {
    try {
      const now = Date.now();
      const cacheAge = now - queueStatsCacheTime;

      if (queueStatsCache && cacheAge < QUEUE_STATS_CACHE_TTL) {
        return {
          data: queueStatsCache,
          cacheHeader: 'HIT',
          cacheControl: 'public, s-maxage=5, stale-while-revalidate=10',
          status: 200,
        };
      }

      if (queueStatsCache) {
        this.refreshQueueStats().catch(() => {});
        return {
          data: queueStatsCache,
          cacheHeader: 'STALE',
          cacheControl: 'public, s-maxage=5, stale-while-revalidate=10',
          status: 200,
        };
      }

      await this.refreshQueueStats();
      return {
        data: queueStatsCache || DEFAULT_QUEUE_STATS,
        cacheHeader: 'MISS',
        cacheControl: 'public, s-maxage=5, stale-while-revalidate=10',
        status: 200,
      };
    } catch {
      return {
        data: queueStatsCache || DEFAULT_QUEUE_STATS,
        cacheHeader: null,
        cacheControl: 'no-cache',
        status: 200,
      };
    }
  }

  static async getStats(admin) {
    if (!admin || admin.role !== 'admin') {
      throw { status: 401, message: 'Unauthorized' };
    }
    const [counts] = await sql`
      SELECT (SELECT COUNT(*)::int FROM users WHERE role = 'faculty') as faculty,
             (SELECT COUNT(*)::int FROM users WHERE role = 'student') as students,
             (SELECT COUNT(*)::int FROM courses) as courses
    `;
    return counts;
  }

  static async getLogs(admin, limit) {
    if (!admin || admin.role !== 'admin') {
      throw { status: 401, message: 'Unauthorized' };
    }
    const pageLimit = limit == null ? 50 : Number(limit);
    if (!Number.isSafeInteger(pageLimit) || pageLimit < 1 || pageLimit > 100) throw { status: 400, message: 'Invalid log limit' };
    return sql`
      SELECT al.id, al.user_id, al.action, al.details, al.created_at,
             u.name AS user_name, u.email AS user_email
      FROM activity_logs al
      LEFT JOIN users u ON u.id = al.user_id
      ORDER BY al.created_at DESC, al.id DESC
      LIMIT ${pageLimit}
    `;
  }
}
