import { NextResponse } from 'next/server';
import { SubmissionService } from '@coderank/core/services/SubmissionService';
import os from 'os';

export const maxDuration = 5;

// In-memory cache for detailed health
let detailedHealthCache = null;
let detailedHealthCacheTime = 0;
let refreshPromise = null;
const DETAILED_HEALTH_CACHE_TTL = 10000; // 10 seconds cache

async function refreshDetailedHealth() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const report = {
        timestamp: new Date().toISOString(),
        systemInfo: {
          nodeVersion: process.version,
          uptimeSeconds: Math.floor(process.uptime()),
          memoryUsage: process.memoryUsage(),
          cpuCount: os.cpus().length,
          platform: os.platform(),
          arch: os.arch()
        },
        connectionPools: {
          database: {
            provider: 'Neon PostgreSQL',
            status: 'managed by PgBouncer',
            note: 'Connection pooling handled by Neon serverless driver'
          },
          redis: {
            status: 'unknown',
            isOpen: false,
            isReady: false
          }
        },
        circuitBreakers: {
          redis: {
            state: 'unknown',
            note: 'Circuit breaker state from rateLimiter'
          },
          database: {
            state: 'not implemented',
            note: 'Database uses timeout wrapper instead of circuit breaker'
          }
        },
        queueStats: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0
        }
      };

      // Redis connection state check
      // Note: Redis client is internal to rateLimiter and CourseService modules
      // We can't directly access it here, so we rely on queue stats success as proxy
      report.connectionPools.redis.status = 'managed by internal modules';
      report.connectionPools.redis.note = 'Redis health indicated by successful queue stats retrieval';

      // Get queue stats
      try {
        const stats = await SubmissionService.getQueueStats();
        report.queueStats = stats;
      } catch (err) {
        report.queueStats.error = err.message;
      }

      // Circuit breaker states would need to be exposed by rateLimiter
      // For now, we document that it's not directly queryable
      report.circuitBreakers.redis.note = 'Circuit breaker state is internal to rateLimiter module';

      detailedHealthCache = report;
      detailedHealthCacheTime = Date.now();

      return report;
    } catch (error) {
      const errorReport = {
        timestamp: new Date().toISOString(),
        error: 'Failed to generate health report',
        message: error.message,
        systemInfo: {
          nodeVersion: process.version,
          uptimeSeconds: Math.floor(process.uptime())
        }
      };
      detailedHealthCache = errorReport;
      detailedHealthCacheTime = Date.now();
      return errorReport;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function GET() {
  try {
    const now = Date.now();
    const cacheAge = now - detailedHealthCacheTime;

    // Return fresh cache if available and not expired
    if (detailedHealthCache && cacheAge < DETAILED_HEALTH_CACHE_TTL) {
      const headers = new Headers({
        'X-Cache': 'HIT',
        'Cache-Control': 's-maxage=10, stale-while-revalidate=20'
      });
      return NextResponse.json(detailedHealthCache, { headers });
    }

    // Return stale cache while refreshing in background
    if (detailedHealthCache && cacheAge < DETAILED_HEALTH_CACHE_TTL * 2) {
      const headers = new Headers({
        'X-Cache': 'STALE',
        'Cache-Control': 's-maxage=10, stale-while-revalidate=20'
      });
      refreshDetailedHealth(); // Fire and forget background refresh
      return NextResponse.json(detailedHealthCache, { headers });
    }

    // Cache miss or too old - fetch synchronously
    const report = await refreshDetailedHealth();
    const headers = new Headers({
      'X-Cache': 'MISS',
      'Cache-Control': 's-maxage=10, stale-while-revalidate=20'
    });
    return NextResponse.json(report, { headers });

  } catch (error) {
    console.error('[/api/health/detailed] Error:', error);
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      error: 'Failed to retrieve detailed health status',
      message: error.message
    }, { status: 500 });
  }
}
