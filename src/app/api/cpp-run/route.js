import { NextResponse } from 'next/server';
import { runCpp } from '@/lib/execution/runCpp';
import { STATIC_PROBLEMS } from '@/lib/problems';
import { exec } from 'child_process';
import { promisify } from 'util';
import { runDynamicPractical } from '@/lib/execution/runDynamicPractical';

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

    if (typeof problemId === 'string' && problemId.startsWith('practical_')) {
      const dbId = parseInt(problemId.replace('practical_', ''));
      const result = await runDynamicPractical({ language: 'cpp', code, dbId, isSubmit: false });
      return NextResponse.json(result, { status: 200 });
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

    // ── 4. Invoke runner (stands ready for local docker or standalone remote compiler service) ──
    let result;
    const compilerUrl = process.env.COMPILER_SERVICE_URL;

    if (compilerUrl) {
      try {
        const response = await fetch(`${compilerUrl.replace(/\/$/, '')}/run-cpp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-compiler-secret': process.env.COMPILER_SECRET || 'super-secret-key-coderank'
          },
          body: JSON.stringify({
            code,
            problem,
            testCases: runnerTestCases
          })
        });

        if (!response.ok) {
          throw new Error(`Compiler service returned status code: ${response.status}`);
        }
        result = await response.json();
      } catch (err) {
        console.error('Compiler service connection failed:', err);
        result = {
          status: 'runtime_error',
          summary: 'Compiler Service Unreachable',
          exitCode: 503,
          compileError: null,
          runtimeError: `Could not reach compiler service. Verify your connection or check if the code server is online. Details: ${err.message}`,
          cases: [],
        };
      }
    } else {
      // Local development fallback
      result = await runCpp({
        code,
        problem,
        testCases: runnerTestCases,
      });
    }

    // Return the execution report (success, status, stdout/stderr compile errors)
    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('API Error in /api/cpp-run:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ success: false, error: 'Method Not Allowed' }, { status: 405 });
}
