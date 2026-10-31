import { withTimeout } from '@coderank/core/utils/timeout';
import { NextResponse } from 'next/server';
import sql from '@coderank/core/db';
import { checkDatabaseReadiness } from '@coderank/core/db-readiness';
import { SubmissionService } from '@coderank/core/services/SubmissionService';

// Health must be evaluated by this server instance. The short in-memory cache
// below protects Redis/Neon; Next/CDN response caching would make its status
// and timestamp misleading during an incident.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 5;

// In-memory cache for health checks
let healthCache = null;
let healthCacheTime = 0;
let refreshPromise = null;
const HEALTH_CACHE_TTL = 10000; // 10 seconds cache for high throughput

// Refresh health status in the background or on demand
async function refreshHealthCache() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const report = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          database: { status: 'unknown' },
          queue: { status: 'unknown' },
          execution: { status: 'unknown' }
        }
      };

      // Run DB and queue checks concurrently to minimize latency (3500ms timeout for cross-region Neon)
      const [dbResult, queueResult, workerResult] = await Promise.allSettled([
        withTimeout(checkDatabaseReadiness(sql.query), 3500),
        withTimeout(SubmissionService.getQueueStats(), 1200),
        withTimeout(SubmissionService.getWorkerStatus(), 1200)
      ]);

      if (dbResult.status === 'fulfilled' && dbResult.value?.healthy === true) {
        report.services.database = {status: 'healthy', schema: 'current'};
      } else {
        report.services.database.status = 'degraded';
        report.services.database.schema = dbResult.status === 'fulfilled' ? dbResult.value.schema : 'unknown';
        report.services.database.error = 'Database unavailable or required migrations are missing or changed';
      }

      if (queueResult.status === 'fulfilled' && !queueResult.value?.cached) {
        report.services.queue.status = 'healthy';
        report.services.queue.stats = queueResult.value;
      } else if (queueResult.status === 'fulfilled') {
        report.services.queue.status = 'degraded';
        report.services.queue.stats = queueResult.value;
        report.services.queue.error = 'Redis queue is unavailable; cached queue statistics are being returned';
      } else {
        report.services.queue.status = 'degraded';
        report.services.queue.error = 'Queue check failed';
      }

      report.services.execution = workerResult.status === 'fulfilled' && workerResult.value.healthy
        ? {status:'healthy',healthyWorkers:workerResult.value.healthyWorkers}
        : {status:'degraded',healthyWorkers:0};

      report.status = Object.values(report.services).every((service) => service.status === 'healthy')
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
          execution: { status: 'degraded' }
        }
      };
      healthCacheTime = Date.now();
      return healthCache;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function GET() {
  const now = Date.now();
  const cacheAge = now - healthCacheTime;

  if (healthCache && cacheAge < HEALTH_CACHE_TTL) {
    return NextResponse.json(healthCache, { 
      status: healthCache.status === 'healthy' ? 200 : 503,
      headers: { 
        'X-Cache': 'HIT',
        'Cache-Control': 'no-store'
      }
    });
  }

  await refreshHealthCache();

  return NextResponse.json(healthCache, { 
    status: healthCache.status === 'healthy' ? 200 : 503,
    headers: { 
      'X-Cache': 'MISS',
      'Cache-Control': 'no-store'
    }
  });
}
