import { NextResponse } from 'next/server';
import { runC } from '@/lib/execution/runC';
import { STATIC_PROBLEMS } from '@/lib/problems';

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON payload.' }, { status: 400 });
    }

    const { code, problemId } = body;

    if (!code || typeof code !== 'string' || code.trim() === '') {
      return NextResponse.json({ success: false, error: 'Code cannot be empty.' }, { status: 400 });
    }

    if (typeof problemId === 'string' && problemId.startsWith('practical_')) {
      const { runDynamicPractical } = await import('@/lib/execution/runDynamicPractical');
      const dbId = parseInt(problemId.replace('practical_', ''));
      const result = await runDynamicPractical({ language: 'c', code, dbId, isSubmit: false });
      return NextResponse.json(result, { status: 200 });
    }

    let problem = STATIC_PROBLEMS[problemId] || Object.values(STATIC_PROBLEMS).find((p) => p.slug === problemId || p.id === Number(problemId));
    if (!problem) {
      return NextResponse.json({ success: false, error: 'Problem not found.' }, { status: 404 });
    }

    const runnerTestCases = (problem.testCases || []).map((tc) => ({
      args: tc.args || [],
      kwargs: tc.kwargs || {},
      expected: tc.expected,
    }));

    const result = await runC({
      code,
      problem,
      testCases: runnerTestCases,
    });

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('API Error in /api/c-run:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
