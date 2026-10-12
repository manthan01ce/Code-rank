import { NextResponse } from 'next/server';
import { SubmissionService } from '@coderank/core/services/SubmissionService';

// Cache for queue stats
let queueStatsCache = null;
let queueStatsCacheTime = 0;
let isRefreshing = false;
const QUEUE_STATS_CACHE_TTL = 5000; // 5 seconds cache for better performance

// Background refresh function
async function refreshQueueStats() {
  if (isRefreshing) return; // Prevent concurrent refreshes
  isRefreshing = true;

  try {
    const timeout = (ms) => new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), ms)
    );
    
    const startTime = Date.now();
    const stats = await Promise.race([
      SubmissionService.getQueueStats(),
      timeout(1200)
    ]);
    
    const duration = Date.now() - startTime;
    queueStatsCache = stats;
    queueStatsCacheTime = Date.now();
    
    console.log('[Queue Stats] Cache refresh succeeded', { duration, timestamp: new Date().toISOString() });
  } catch (error) {
    const cacheAge = Date.now() - queueStatsCacheTime;
    const cacheAvailable = queueStatsCache !== null;
    console.error('[Queue Stats] Refresh timeout/error', { 
      error: error.message, 
      timestamp: new Date().toISOString(),
      cacheAge,
      cacheAvailable
    });
    // Keep existing cache on error
  } finally {
    isRefreshing = false;
  }
}

export async function GET() {
  try {
    const now = Date.now();
    const cacheAge = now - queueStatsCacheTime;

    // Return cached response if still valid (within TTL)
    if (queueStatsCache && cacheAge < QUEUE_STATS_CACHE_TTL) {
      console.log('[Queue Stats] Cache HIT', { cacheAge, timestamp: new Date().toISOString() });
      return NextResponse.json(queueStatsCache, {
        headers: { 
          'X-Cache': 'HIT',
          'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10'
        }
      });
    }

    // Stale-while-revalidate: if cache is stale but within TTL*3, return stale and refresh in background
    if (queueStatsCache && cacheAge < QUEUE_STATS_CACHE_TTL * 3) {
      console.log('[Queue Stats] Cache STALE (serving stale, refreshing in background)', { cacheAge, timestamp: new Date().toISOString() });
      // Trigger background refresh (non-blocking)
      refreshQueueStats().catch(() => {/* ignore */});
      
      return NextResponse.json(queueStatsCache, {
        headers: { 
          'X-Cache': 'STALE',
          'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10'
        }
      });
    }

    // Cache completely expired or doesn't exist - fetch synchronously
    console.log('[Queue Stats] Cache MISS (fetching synchronously)', { cacheAge, cacheExists: queueStatsCache !== null, timestamp: new Date().toISOString() });
    await refreshQueueStats();
    
    if (queueStatsCache) {
      return NextResponse.json(queueStatsCache, {
        headers: { 
          'X-Cache': 'MISS',
          'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10'
        }
      });
    }

    // Fallback if refresh failed and no cache exists
    console.error('[Queue Stats] Fallback to error response (no cache available)', { timestamp: new Date().toISOString() });
    return NextResponse.json({ 
      error: 'Service temporarily unavailable',
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0
    }, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error) {
    const cacheAge = Date.now() - queueStatsCacheTime;
    console.error('GET /api/queue/stats error:', { 
      error: error.message, 
      timestamp: new Date().toISOString(),
      cacheAge,
      cacheAvailable: queueStatsCache !== null
    });
    
    // Return cached data if available, even if expired
    if (queueStatsCache) {
      console.log('[Queue Stats] Error fallback to stale cache', { cacheAge, timestamp: new Date().toISOString() });
      return NextResponse.json(queueStatsCache, { 
        status: 200,
        headers: { 
          'X-Cache': 'STALE',
          'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10'
        }
      });
    }
    
    return NextResponse.json({ 
      error: 'Service temporarily unavailable',
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0
    }, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
  }
}
