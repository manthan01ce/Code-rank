import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { authenticateRequest } from '@coderank/core/security/active-actor';
import { memoryCache } from '@/lib/cache';

const STATS_CACHE_KEY = 'admin_stats';

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Try reading from memory cache
    const cachedStats = memoryCache.get(STATS_CACHE_KEY);
    if (cachedStats) {
      return NextResponse.json(cachedStats);
    }

    // Combined counts into a single SQL query round-trip
    const result = await sql`
      SELECT 
        (SELECT COUNT(*)::int FROM users WHERE role = 'faculty') as faculty,
        (SELECT COUNT(*)::int FROM users WHERE role = 'student') as students,
        (SELECT COUNT(*)::int FROM courses) as courses
    `;

    const stats = {
      faculty: result[0].faculty,
      students: result[0].students,
      courses: result[0].courses
    };

    // Cache the query results for 30 seconds
    memoryCache.set(STATS_CACHE_KEY, stats, 30000);

    return NextResponse.json(stats);
  } catch (error) {
    if (error.status) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Stats fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
