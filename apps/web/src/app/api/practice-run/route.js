/**
 * apps/web/src/app/api/practice-run/route.js
 *
 * Playground / free-run endpoint for Python code with custom stdin.
 * Previously spawned Docker directly in the web process — now dispatches
 * to BullMQ so execution is isolated to the worker process.
 *
 * GET /api/practice-run — health-check that Docker + queue are reachable.
 * POST /api/practice-run — queue a playground job; returns { jobId, status }.
 */
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { enqueueJob } from '@/lib/queue/jobQueue';
import { checkRateLimit } from '@/lib/queue/rateLimiter';
import { getUserFromRequest } from '@coderank/core/utils/auth';
import { SubmissionService } from '@coderank/core/services/SubmissionService';

export const maxDuration = 30;

export async function POST(request) {
  try {
    const user   = getUserFromRequest(request);
    const userId = user ? user.id : null;

    // Read or generate anonymous session
    const cookieHeader  = request.headers.get('cookie') || '';
    const anonMatch     = cookieHeader.match(/(?:^|;\s*)anon_session=([^;]+)/);
    const anonSessionId = anonMatch ? anonMatch[1] : null;
    const rateKey       = userId ? String(userId) : (anonSessionId || 'anon-pre-session');

    const rate = await checkRateLimit(rateKey, 'run');
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too Many Requests', retryAfter: rate.retryAfter },
        { status: 429 }
      );
    }

    let body;
    try { body = await request.json(); }
    catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON payload.' }, { status: 400 });
    }

    const { code } = body;
    const stdin = body.input !== undefined ? body.input : (body.stdin || '');

    if (!code || typeof code !== 'string' || code.trim() === '') {
      return NextResponse.json({ success: false, error: 'Code cannot be empty.' }, { status: 400 });
    }

    const newAnonSession = anonSessionId || randomUUID();
    let jobId;
    try {
      jobId = await enqueueJob(
        'playground',
        { language: 'python', code, input: stdin },
        userId,
        userId ? null : newAnonSession
      );
    } catch (err) {
      if (err.message === 'QUEUE_FULL') {
        return NextResponse.json(
          { error: 'Server is busy. Please try again in a moment.' },
          { status: 503, headers: { 'Retry-After': '5' } }
        );
      }
      throw err;
    }

    const response = NextResponse.json({ jobId, status: 'queued' }, { status: 202 });
    if (!userId && !anonSessionId) {
      response.headers.set(
        'Set-Cookie',
        `anon_session=${newAnonSession}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`
      );
    }
    return response;
  } catch (error) {
    console.error('API Error in /api/practice-run:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

// GET: lightweight health-check — queue reachable?
export async function GET() {
  try {
    const stats = await SubmissionService.getQueueStats();
    return NextResponse.json({
      status: stats.cached ? 'degraded' : 'healthy',
      queue: stats,
      message: stats.cached
        ? 'Queue stats cached — Redis may be unreachable'
        : 'Queue is reachable'
    });
  } catch {
    return NextResponse.json({ status: 'error', message: 'Queue unreachable' }, { status: 503 });
  }
}
