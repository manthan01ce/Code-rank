/**
 * apps/web/src/lib/execution-api.js
 *
 * Unified execution adapter used by all language run-route handlers:
 *   /api/c-run, /api/cpp-run, /api/python-run, /api/java-run,
 *   /api/javascript-run, /api/execute
 *
 * Enforces:
 *   - Rate limiting (per-user or per-anonymous-session)
 *   - Practical authorization (role, batch, semester, active session, start time)
 *   - Queue-based dispatch (never direct Docker in web process)
 *   - Anonymous session cookie creation for result privacy
 *
 * Returns a NextResponse directly so callers just `return handleRunRequest(...)`.
 */

import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { enqueueJob } from '@/lib/queue/jobQueue';
import { checkRateLimit } from '@/lib/queue/rateLimiter';
import { getUserFromRequest } from '@coderank/core/utils/auth';
import { STATIC_PROBLEMS } from '@/lib/problems';
import sql from '@coderank/core/db';

/**
 * C and JavaScript have no function-harness for static practice problems.
 * Return an explicit unsupported error rather than silently grading the wrong contract.
 */
const FUNCTION_HARNESS_UNSUPPORTED = new Set(['c', 'javascript']);

/**
 * Main entry point called by every language run-route.
 *
 * @param {Request} request    - Next.js Request object
 * @param {string}  language   - canonical language string ('python', 'cpp', 'c', 'java', 'javascript')
 * @param {string}  routeName  - used only for error logging (e.g. '/api/c-run')
 */
export async function handleRunRequest(request, language, routeName) {
  try {
    const user = getUserFromRequest(request);
    const userId = user ? user.id : null;

    // --- Rate limiting -------------------------------------------------------
    // Anonymous users share a conservative bucket keyed on their anon session;
    // if they have no session yet we key on 'anon-pre-session'.
    const cookieHeader = request.headers.get('cookie') || '';
    const anonMatch    = cookieHeader.match(/(?:^|;\s*)anon_session=([^;]+)/);
    const anonSessionId = anonMatch ? anonMatch[1] : null;
    const rateKey = userId ? String(userId) : (anonSessionId || 'anon-pre-session');

    const rate = await checkRateLimit(rateKey, 'run');
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too Many Requests', retryAfter: rate.retryAfter },
        { status: 429 }
      );
    }

    // --- Parse body ----------------------------------------------------------
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload.' },
        { status: 400 }
      );
    }

    const { code, problemId } = body;

    if (!code || typeof code !== 'string' || code.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Code cannot be empty.' },
        { status: 400 }
      );
    }
    if (!problemId) {
      return NextResponse.json(
        { success: false, error: 'problemId is required.' },
        { status: 400 }
      );
    }

    // =========================================================================
    // Branch A: Dynamic practical (problemId like 'practical_42')
    // =========================================================================
    if (typeof problemId === 'string' && problemId.startsWith('practical_')) {
      const dbId = parseInt(problemId.replace('practical_', ''), 10);
      if (isNaN(dbId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid practical id.' },
          { status: 400 }
        );
      }

      // ---- Practical authorization (only enforced when a user is logged in) -
      if (user) {
        if (user.role !== 'student' && user.role !== 'faculty' && user.role !== 'admin') {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (user.role === 'student') {
          const practicals = await sql`
            SELECT p.*, c.semester
            FROM practicals p
            JOIN courses c ON p.course_id = c.id
            WHERE p.id = ${dbId} AND p.status = 'active'
          `;
          if (practicals.length === 0) {
            return NextResponse.json(
              { success: false, error: 'Practical not found or inactive.' },
              { status: 404 }
            );
          }
          const practical = practicals[0];

          if (practical.start_time && new Date() < new Date(practical.start_time)) {
            return NextResponse.json(
              { success: false, error: 'This practical has not started yet.' },
              { status: 403 }
            );
          }

          const students = await sql`SELECT extra_info FROM users WHERE id = ${user.id}`;
          if (students.length === 0) {
            return NextResponse.json(
              { success: false, error: 'Student profile not found.' },
              { status: 404 }
            );
          }
          const extra = students[0].extra_info || {};
          const batchMismatch =
            practical.batch_id !== 'All' && extra.batch !== practical.batch_id;
          const semesterMismatch =
            parseInt(extra.semester) !== practical.semester;
          if (batchMismatch || semesterMismatch) {
            return NextResponse.json(
              { error: 'Access denied: This practical is not assigned to your batch/semester.' },
              { status: 403 }
            );
          }
        }
      }

      // ---- Enqueue -----------------------------------------------------------
      try {
        const newAnonSession = anonSessionId || randomUUID();
        const jobId = await enqueueJob(
          'dynamic',
          { language, code, dbId, userId, isSubmit: false },
          userId,
          userId ? null : newAnonSession
        );
        const response = NextResponse.json({ jobId, status: 'queued' }, { status: 202 });
        if (!userId && !anonSessionId) {
          response.headers.set(
            'Set-Cookie',
            `anon_session=${newAnonSession}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`
          );
        }
        return response;
      } catch (err) {
        if (err.message === 'QUEUE_FULL') {
          return NextResponse.json(
            { error: 'Server is busy. Please try again in a moment.' },
            { status: 503, headers: { 'Retry-After': '5' } }
          );
        }
        throw err;
      }
    }

    // =========================================================================
    // Branch B: Static practice problem
    // =========================================================================
    const problem =
      STATIC_PROBLEMS[problemId] ||
      Object.values(STATIC_PROBLEMS).find(
        p => p.slug === problemId || p.id === Number(problemId)
      );
    if (!problem) {
      return NextResponse.json(
        { success: false, error: 'Problem not found.' },
        { status: 404 }
      );
    }

    // C and JavaScript function-style practice not yet supported
    if (FUNCTION_HARNESS_UNSUPPORTED.has(language) && problem.entry?.type === 'class-method') {
      return NextResponse.json({
        success: false,
        status: 'unsupported',
        error: `Function-style practice for ${language.toUpperCase()} is not yet supported. ` +
               'Use the stdin/stdout path or switch to Python / C++.',
      }, { status: 422 });
    }

    const runnerTestCases = (problem.testCases || []).map(tc => ({
      args:     tc.args     || [],
      kwargs:   tc.kwargs   || {},
      expected: tc.expected,
    }));

    try {
      const newAnonSession = anonSessionId || randomUUID();
      const jobId = await enqueueJob(
        'practice',
        { language, code, problem, testCases: runnerTestCases },
        userId,
        userId ? null : newAnonSession
      );
      const response = NextResponse.json({ jobId, status: 'queued' }, { status: 202 });
      if (!userId && !anonSessionId) {
        response.headers.set(
          'Set-Cookie',
          `anon_session=${newAnonSession}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`
        );
      }
      return response;
    } catch (err) {
      if (err.message === 'QUEUE_FULL') {
        return NextResponse.json(
          { error: 'Server is busy. Please try again in a moment.' },
          { status: 503, headers: { 'Retry-After': '5' } }
        );
      }
      throw err;
    }
  } catch (error) {
    console.error(`API Error in ${routeName}:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
