import { NextResponse } from 'next/server';
import sql from '@coderank/core/db';
import { SubmissionService } from '@coderank/core/services/SubmissionService';

// Health must be evaluated by this server instance. The short in-memory cache
// below protects Redis/Neon; Next/CDN response caching would make its status
// and timestamp misleading during an incident.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
          queue: { status: 'unknown' }
        }
      };

      const timeout = (ms) => new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), ms)
      );

      // Run DB and queue checks concurrently to minimize latency (3500ms timeout for cross-region Neon)
      const [dbResult, queueResult] = await Promise.allSettled([
        Promise.race([sql`SELECT 1 as active`, timeout(3500)]),
        Promise.race([SubmissionService.getQueueStats(), timeout(1200)])
      ]);

      if (dbResult.status === 'fulfilled' && dbResult.value && dbResult.value[0]?.active === 1) {
        report.services.database.status = 'healthy';
      } else if (healthCache && healthCache.services?.database?.status === 'healthy') {
        // Retain healthy status during transient cloud latency spike to US-East
        report.services.database.status = 'healthy';
        report.services.database.warning = dbResult.status === 'rejected' ? dbResult.reason?.message : 'Slow DB response';
      } else {
        report.services.database.status = 'degraded';
        report.services.database.error = dbResult.status === 'rejected' ? dbResult.reason?.message : 'Database check failed';
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
        report.services.queue.error = queueResult.status === 'rejected' ? queueResult.reason?.message : 'Queue check failed';
      }

      report.status = Object.values(report.services).every((service) => service.status === 'healthy')
        ? 'healthy'
        : 'degraded';

      healthCache = report;
      healthCacheTime = Date.now();
      return report;
    } catch (err) {
      if (!healthCache) {
        healthCache = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          services: {
            database: { status: 'degraded', error: err.message },
            queue: { status: 'degraded' }
          }
        };
        healthCacheTime = Date.now();
      }
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

  // If cache is fresh, return immediately with HIT
  if (healthCache && cacheAge < HEALTH_CACHE_TTL) {
    return NextResponse.json(healthCache, { 
      status: 200,
      headers: { 
        'X-Cache': 'HIT',
        'Cache-Control': 'no-store'
      }
    });
  }

  // If cache exists but is stale, return stale cache immediately and trigger background refresh
  if (healthCache) {
    refreshHealthCache().catch(() => {/* ignore */});
    
    return NextResponse.json(healthCache, { 
      status: 200,
      headers: { 
        'X-Cache': 'STALE',
        'Cache-Control': 'no-store'
      }
    });
  }

  // Cold start (cache is null) - perform initial refresh
  await refreshHealthCache();

  return NextResponse.json(healthCache, { 
    status: 200,
    headers: { 
      'X-Cache': 'MISS',
        'Cache-Control': 'no-store'
    }
  });
}
