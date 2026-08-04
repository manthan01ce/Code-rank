import { NextResponse } from 'next/server';
import { RUNNERS, ALLOWED_LANGUAGES } from '@/lib/execution/index.js';
import { STATIC_PROBLEMS } from '@/lib/problems';

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON payload.' }, { status: 400 });
    }

    const { code, problemId, language = 'python' } = body;

    // ── 1. Validate payload shape ──
    if (!code || typeof code !== 'string' || code.trim() === '') {
      return NextResponse.json({ success: false, error: 'Code cannot be empty.' }, { status: 400 });
    }

    if (!problemId) {
      return NextResponse.json({ success: false, error: 'problemId is required.' }, { status: 400 });
    }

    if (!ALLOWED_LANGUAGES.has(language)) {
      return NextResponse.json({ success: false, error: `Unsupported language: ${language}` }, { status: 400 });
    }

    // ── 2. Find problem statically ──
    let problem = STATIC_PROBLEMS[problemId];
    if (!problem) {
      problem = Object.values(STATIC_PROBLEMS).find(
        (p) => p.slug === problemId || p.id === Number(problemId)
      );
    }

    if (!problem) {
      return NextResponse.json({ success: false, error: 'Problem not found.' }, { status: 404 });
    }

    // ── 3. Map the static sample test cases ──
    const runnerTestCases = problem.testCases.map((tc) => ({
      args: tc.args || [],
      kwargs: tc.kwargs || {},
      expected: tc.expected,
    }));

    // ── 4. Invoke selected language runner ──
    const runner = RUNNERS[language] || RUNNERS.python;
    const result = await runner({
      code,
      problem,
      testCases: runnerTestCases,
    });

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('API Error in /api/run:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
