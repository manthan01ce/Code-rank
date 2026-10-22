import { NextResponse } from 'next/server';
import { authenticateRequest } from '@coderank/core/security/active-actor';
import { getHttpMetrics } from '@/lib/observability';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Metrics expose process details and are restricted to administrators.
export async function GET(request) {
  try {
  const user = await authenticateRequest(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json(getHttpMetrics(), {
    headers: { 'Cache-Control': 'no-store' },
  });
  } catch (error) {
    return NextResponse.json({ error: error.status ? error.message : 'Internal server error' }, { status: error.status || 500 });
  }
}
