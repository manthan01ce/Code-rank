import { NextResponse } from 'next/server';
import { SubmissionService } from '@coderank/core/services/SubmissionService';
import { checkRateLimit } from '@/lib/queue/rateLimiter';
import { getUserFromRequest } from '@coderank/core/utils/auth';

const ALLOWED_LANGUAGES = new Set(['python', 'cpp', 'c', 'java', 'javascript']);

export async function POST(request) {
  try {
    const user = getUserFromRequest(request);
    const userId = user ? user.id : 'anonymous';

    const rate = await checkRateLimit(userId.toString(), 'run');
    if (!rate.allowed) return NextResponse.json({ error: 'Too Many Requests', retryAfter: rate.retryAfter }, { status: 429 });

    const body = await request.json();
    const { language, code, input } = body;

    if (!language || !ALLOWED_LANGUAGES.has(language)) {
      return NextResponse.json({ success: false, error: `Invalid language. Allowed: ${[...ALLOWED_LANGUAGES].join(', ')}` }, { status: 400 });
    }

    if (!code || typeof code !== 'string' || code.trim() === '') {
      return NextResponse.json({ success: false, error: 'Code cannot be empty.' }, { status: 400 });
    }

    try {
      const jobId = await SubmissionService.enqueueJob('playground', { language, code, input: input ?? '' }, user ? user.id : null);
      return NextResponse.json({ jobId, status: 'queued' }, { status: 202 });
    } catch (err) {
      if (err.message === 'QUEUE_FULL') return NextResponse.json({ error: 'Server is busy. Please try again in a moment.' }, { status: 503 });
      throw err;
    }

  } catch (error) {
    console.error('[/api/execute] Unhandled error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const stats = await SubmissionService.getQueueStats();
    return NextResponse.json({
      status: 'healthy',
      queue: stats,
      languages: Array.from(ALLOWED_LANGUAGES),
      message: 'Execution engine queue is operational.'
    });
  } catch (err) {
    return NextResponse.json(
      { status: 'error', message: 'Execution queue unreachable: ' + err.message },
      { status: 503 }
    );
  }
}
