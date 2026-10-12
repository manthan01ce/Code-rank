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
    
    const stats = await Promise.race([
      SubmissionService.getQueueStats(),
      timeout(150)
    ]);
    
    queueStatsCache = stats;
    queueStatsCacheTime = Date.now();
  } catch (error) {
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
      return NextResponse.json(queueStatsCache, {
        headers: { 
          'X-Cache': 'HIT',
          'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10'
        }
      });
    }

    // Stale-while-revalidate: if cache is stale but within TTL*2, return stale and refresh in background
    if (queueStatsCache && cacheAge < QUEUE_STATS_CACHE_TTL * 2) {
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
    console.error('GET /api/queue/stats error:', error);
    
    // Return cached data if available, even if expired
    if (queueStatsCache) {
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
