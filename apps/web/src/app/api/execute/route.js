import { NextResponse } from 'next/server';
import { SubmissionService } from '@coderank/core/services/SubmissionService';
import { enqueueExecution, executionError } from '@/lib/execution-api';

export const maxDuration = 30;

const ALLOWED_LANGUAGES = new Set(['python', 'cpp', 'c', 'java', 'javascript']);

export async function POST(request) {
  try {
    let body;
    try { body = await request.json(); } catch { throw { status: 400, message: 'Invalid JSON payload' }; }
    return await enqueueExecution(request, 'playground', { language: body?.language, code: body?.code, input: body?.input ?? '' });
  } catch (error) { return executionError(error); }
}

export async function GET() {
  try {
    const stats = await SubmissionService.getQueueStats();
    return NextResponse.json({
      status: stats.cached ? 'degraded' : 'healthy',
      queue: stats,
      languages: Array.from(ALLOWED_LANGUAGES),
      message: 'Execution queue connectivity; runner capacity is monitored separately'
    }, { status: stats.cached ? 503 : 200, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json(
      { status: 'error', message: 'Execution queue unavailable' },
      { status: 503 }
    );
  }
}
