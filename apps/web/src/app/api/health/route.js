import { NextResponse } from 'next/server';
import sql from '@coderank/core/db';
import { SubmissionService } from '@coderank/core/services/SubmissionService';

// Simple in-memory cache for health checks
let healthCache = null;
let healthCacheTime = 0;
let isRefreshing = false;
const HEALTH_CACHE_TTL = 10000; // 10 seconds cache for better performance

// Background refresh function
async function refreshHealthCache() {
  if (isRefreshing) return; // Prevent concurrent refreshes
  isRefreshing = true;

  try {
    const report = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: { status: 'unknown' },
        queue: { status: 'unknown' }
      }
    };

    // Timeout helper
    const timeout = (ms) => new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), ms)
    );

    // Database check with timeout (increased to 2000ms for Neon cold starts)
    try {
      const dbResult = await Promise.race([
        sql`SELECT 1 as active`,
        timeout(2000)
      ]);
      
      if (dbResult && dbResult[0]?.active === 1) {
        report.services.database.status = 'healthy';
      } else {
        report.services.database.status = 'unhealthy';
        report.status = 'unhealthy';
      }
    } catch (dbErr) {
      report.services.database.status = 'unhealthy';
      report.services.database.error = dbErr.message;
      report.status = 'unhealthy';
    }

    // Queue check with timeout (increased to 1000ms)
    try {
      const queueStats = await Promise.race([
        SubmissionService.getQueueStats(),
        timeout(1000)
      ]);
      report.services.queue.status = 'healthy';
      report.services.queue.stats = queueStats;
    } catch (queueErr) {
      report.services.queue.status = 'degraded';
      report.services.queue.error = queueErr.message;
    }

    // Update cache
    healthCache = report;
    healthCacheTime = Date.now();
  } finally {
    isRefreshing = false;
  }
}

export async function GET() {
  const now = Date.now();
  const cacheAge = now - healthCacheTime;

  // Return cached response if still valid (within TTL)
  if (healthCache && cacheAge < HEALTH_CACHE_TTL) {
    return NextResponse.json(healthCache, { 
      status: healthCache.status === 'healthy' ? 200 : 500,
      headers: { 
        'X-Cache': 'HIT',
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=20'
      }
    });
  }

  // Stale-while-revalidate: if cache is stale but within TTL*2, return stale and refresh in background
  if (healthCache && cacheAge < HEALTH_CACHE_TTL * 2) {
    // Trigger background refresh (non-blocking)
    refreshHealthCache().catch(() => {/* ignore */});
    
    return NextResponse.json(healthCache, { 
      status: healthCache.status === 'healthy' ? 200 : 500,
      headers: { 
        'X-Cache': 'STALE',
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=20'
      }
    });
  }

  // Cache completely expired or doesn't exist - fetch synchronously
  await refreshHealthCache();

  return NextResponse.json(healthCache, { 
    status: healthCache.status === 'healthy' ? 200 : 500,
    headers: { 
      'X-Cache': 'MISS',
      'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=20'
    }
  });
}
