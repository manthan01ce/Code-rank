import { NextResponse } from 'next/server';
import { StudentPracticalService } from '@coderank/core/services/StudentPracticalService';
import { authenticateRequest } from '@coderank/core/security/active-actor';
import { routeError } from '@/lib/route-response';

export async function GET(request, { params }) {
  try {
    return NextResponse.json(await StudentPracticalService.detail(await authenticateRequest(request),(await params).id), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return routeError(error); }
}
