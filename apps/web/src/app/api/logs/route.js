import { NextResponse } from 'next/server';
import { OperationsService } from '@coderank/core/services/OperationsService';
import { authenticateRequest } from '@coderank/core/security/active-actor';
import { routeError } from '@/lib/route-response';

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    const logs = await OperationsService.logs(user, new URL(request.url).searchParams.get('limit'));
    return NextResponse.json(logs, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return routeError(error); }
}
