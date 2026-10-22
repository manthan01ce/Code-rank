import { NextResponse } from 'next/server';
import { enqueueExecution, executionError } from '@/lib/execution-api';
import { SubmissionService } from '@coderank/core/services/SubmissionService';

export async function POST(request) {
  try {
    let body;
    try { body = await request.json(); } catch { throw { status: 400, message: 'Invalid JSON payload' }; }
    return await enqueueExecution(request, 'playground', { language: 'python', code: body?.code, input: body?.input ?? body?.stdin ?? '' });
  } catch (error) { return executionError(error); }
}
export async function GET() {
  const queue = await SubmissionService.getQueueStats();
  return NextResponse.json({ status: queue.cached ? 'degraded' : 'healthy', queue, message: 'Execution queue connectivity; runner capacity is monitored separately' }, { status: queue.cached ? 503 : 200, headers: { 'Cache-Control': 'no-store' } });
}
