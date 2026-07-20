import { NextResponse } from 'next/server';
import { runPython } from '@/lib/execution/runPython';
import { STATIC_PROBLEMS } from '@/lib/problems';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON payload.' }, { status: 400 });
    }

    const { code, problemId } = body;

    // ── 1. Validate payload shape ──
    if (!code || typeof code !== 'string' || code.trim() === '') {
      return NextResponse.json({ success: false, error: 'Code cannot be empty.' }, { status: 400 });
    }

    if (!problemId) {
      return NextResponse.json({ success: false, error: 'problemId is required.' }, { status: 400 });
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

    // ── 3. Map the 5 static sample test cases ──
    const runnerTestCases = problem.testCases.map((tc) => ({
      args: tc.args || [],
      kwargs: tc.kwargs || {},
      expected: tc.expected,
    }));

    // ── 4. Invoke runner ──
    const result = await runPython({
      code,
      problem,
      testCases: runnerTestCases,
    });

    // Return the execution report (success, status, stdout/stderr compile errors)
    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('API Error in /api/python-run:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { stdout } = await execAsync('docker images -q python:3.12-slim');
    if (stdout.trim()) {
      return NextResponse.json({ status: 'healthy', message: 'Docker is running and python:3.12-slim is available.' });
    } else {
      return NextResponse.json({ status: 'warning', message: 'Docker is running but python:3.12-slim image is missing.' }, { status: 404 });
    }
  } catch (err) {
    return NextResponse.json({ status: 'error', message: 'Docker is not running or not installed on the host machine.' }, { status: 503 });
  }
}
