import { NextResponse } from 'next/server';
import { SubmissionService } from '@coderank/core/services/SubmissionService';

// In-memory cache for queue stats
let queueStatsCache = null;
let queueStatsCacheTime = 0;
let refreshPromise = null;
const QUEUE_STATS_CACHE_TTL = 5000; // 5 seconds cache

const DEFAULT_STATS = {
  waiting: 0,
  active: 0,
  completed: 0,
  failed: 0,
  delayed: 0
};

// Background refresh function with shared promise
async function refreshQueueStats() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const timeout = (ms) => new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), ms)
      );
      
      const stats = await Promise.race([
        SubmissionService.getQueueStats(),
        timeout(1000)
      ]);
      
      queueStatsCache = stats || DEFAULT_STATS;
      queueStatsCacheTime = Date.now();
      return queueStatsCache;
    } catch {
      // Keep existing cache on error or initialize with default
      if (!queueStatsCache) {
        queueStatsCache = DEFAULT_STATS;
        queueStatsCacheTime = Date.now();
      }
      return queueStatsCache;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function GET() {
  try {
    const now = Date.now();
    const cacheAge = now - queueStatsCacheTime;

    // Cache HIT: return immediately
    if (queueStatsCache && cacheAge < QUEUE_STATS_CACHE_TTL) {
      return NextResponse.json(queueStatsCache, {
        headers: { 
          'X-Cache': 'HIT',
          'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10'
        }
      });
    }

    // Cache STALE: serve stale immediately and refresh in background
    if (queueStatsCache) {
      refreshQueueStats().catch(() => {/* ignore */});
      
      return NextResponse.json(queueStatsCache, {
        headers: { 
          'X-Cache': 'STALE',
          'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10'
        }
      });
    }

    // Cold start MISS: initial fetch
    await refreshQueueStats();
    
    return NextResponse.json(queueStatsCache || DEFAULT_STATS, {
      headers: { 
        'X-Cache': 'MISS',
        'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10'
      }
    });
  } catch {
    return NextResponse.json(queueStatsCache || DEFAULT_STATS, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
  }
}
