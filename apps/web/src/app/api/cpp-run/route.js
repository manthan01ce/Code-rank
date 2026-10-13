import { NextResponse } from 'next/server';
import { enqueueJob } from '@/lib/queue/jobQueue';
import { checkRateLimit } from '@/lib/queue/rateLimiter';
import { getUserFromRequest } from '@/lib/auth';
import { STATIC_PROBLEMS } from '@/lib/problems';

export const maxDuration = 30;

export async function POST(request) {
  try {
    const user = getUserFromRequest(request);
    const userId = user ? user.id : 'anonymous';

    const rate = await checkRateLimit(userId.toString(), 'run');
    if (!rate.allowed) return NextResponse.json({ error: 'Too Many Requests', retryAfter: rate.retryAfter }, { status: 429 });

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON payload.' }, { status: 400 });
    }

    const { code, problemId } = body;
    const language = 'cpp';

    if (!code || typeof code !== 'string' || code.trim() === '') return NextResponse.json({ success: false, error: 'Code cannot be empty.' }, { status: 400 });
    if (!problemId) return NextResponse.json({ success: false, error: 'problemId is required.' }, { status: 400 });

    if (typeof problemId === 'string' && problemId.startsWith('practical_')) {
      const dbId = parseInt(problemId.replace('practical_', ''));
      try {
        const jobId = await enqueueJob('dynamic', { language, code, dbId, userId: user ? user.id : null, isSubmit: false }, user ? user.id : null);
        return NextResponse.json({ jobId, status: 'queued' }, { status: 202 });
      } catch (err) {
        if (err.message === 'QUEUE_FULL') return NextResponse.json({ error: 'Server is busy. Please try again in a moment.' }, { status: 503, headers: { 'Retry-After': '5' } });
        throw err;
      }
    }

    let problem = STATIC_PROBLEMS[problemId] || Object.values(STATIC_PROBLEMS).find((p) => p.slug === problemId || p.id === Number(problemId));
    if (!problem) return NextResponse.json({ success: false, error: 'Problem not found.' }, { status: 404 });

    const runnerTestCases = (problem.testCases || []).map((tc) => ({
      args: tc.args || [],
      kwargs: tc.kwargs || {},
      expected: tc.expected,
    }));

    try {
      const jobId = await enqueueJob('practice', { language, code, problem, testCases: runnerTestCases }, user ? user.id : null);
      return NextResponse.json({ jobId, status: 'queued' }, { status: 202 });
    } catch (err) {
      if (err.message === 'QUEUE_FULL') return NextResponse.json({ error: 'Server is busy. Please try again in a moment.' }, { status: 503 });
      throw err;
    }
  } catch (error) {
    console.error('API Error in /api/cpp-run:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
