import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@coderank/core/utils/auth';
import { getHttpMetrics } from '@/lib/observability';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Metrics expose process details and are restricted to administrators.
export function GET(request) {
  const user = getUserFromRequest(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json(getHttpMetrics(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
