import { NextResponse } from 'next/server';
import { ALLOWED_LANGUAGES } from '@/lib/execution/index';
import { enqueueJob } from '@/lib/queue/jobQueue';
import { checkRateLimit } from '@/lib/queue/rateLimiter';
import { getUserFromRequest } from '@/lib/auth';
import { STATIC_PROBLEMS } from '@/lib/problems';
import sql from '@/lib/db';

export async function POST(request) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const rate = await checkRateLimit(user.id.toString(), 'submit');
    if (!rate.allowed) {
      return NextResponse.json({ error: 'Too Many Requests', retryAfter: rate.retryAfter }, { status: 429 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON payload.' }, { status: 400 });
    }

    const { problemId, language, code } = body;

    if (!problemId) return NextResponse.json({ success: false, error: 'problemId is required.' }, { status: 400 });
    if (!language || !ALLOWED_LANGUAGES.has(language)) return NextResponse.json({ success: false, error: `Unsupported language: ${language}` }, { status: 400 });
    if (!code || typeof code !== 'string' || code.trim() === '') return NextResponse.json({ success: false, error: 'Code is required and cannot be empty.' }, { status: 400 });

    if (typeof problemId === 'string' && problemId.startsWith('practical_')) {
      const dbId = parseInt(problemId.replace('practical_', ''));

      // Check start_time before queueing
      const practicals = await sql`
        SELECT start_time FROM practicals WHERE id = ${dbId} AND status = 'active'
      `;
      if (practicals.length > 0 && practicals[0].start_time && new Date() < new Date(practicals[0].start_time)) {
        return NextResponse.json({ 
          error: `This practical has not started yet. Starts at ${new Date(practicals[0].start_time).toLocaleString()}` 
        }, { status: 403 });
      }

      try {
        const jobId = await enqueueJob('dynamic', { language, code, dbId, userId: user.id, isSubmit: true }, user.id);
        return NextResponse.json({ jobId, status: 'queued' }, { status: 202 });
      } catch (err) {
        if (err.message === 'QUEUE_FULL') return NextResponse.json({ error: 'Server is busy. Please try again in a moment.' }, { status: 503 });
        throw err;
      }
    }

    // Static problem mapping
    let problem = STATIC_PROBLEMS[problemId] || Object.values(STATIC_PROBLEMS).find((p) => p.slug === problemId || p.id === Number(problemId));
    if (!problem) return NextResponse.json({ success: false, error: 'Problem not found.' }, { status: 404 });

    const runnerTestCases = problem.testCases.map((tc) => ({
      args: tc.args || [],
      kwargs: tc.kwargs || {},
      expected: tc.expected,
    }));

    try {
      const jobId = await enqueueJob('practice', { language, code, problem, testCases: runnerTestCases }, user.id);
      return NextResponse.json({ jobId, status: 'queued' }, { status: 202 });
    } catch (err) {
      if (err.message === 'QUEUE_FULL') return NextResponse.json({ error: 'Server is busy. Please try again in a moment.' }, { status: 503 });
      throw err;
    }
  } catch (error) {
    console.error('API Error in /api/submit:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
