import { NextResponse } from 'next/server';
import { PracticalReportService } from '@coderank/core/services/PracticalReportService';
import { authenticateRequest } from '@coderank/core/security/active-actor';
import { routeError } from '@/lib/route-response';

export async function GET(request, { params }) {
  try {
    const query = new URL(request.url).searchParams;
    return NextResponse.json(await PracticalReportService.stats(await authenticateRequest(request), (await params).id, { cursor: query.get('cursor'), limit: query.get('limit') || 50 }), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return routeError(error); }
}
