import { NextResponse } from 'next/server';
import { SubmissionService } from '@coderank/core/services/SubmissionService';
import { PracticalService } from '@coderank/core/services/PracticalService';
import { authenticateRequest } from '@coderank/core/security/active-actor';
import { guestActor, GUEST_COOKIE, validateExecution } from '@coderank/core/security/execution';
import { checkRateLimit } from './queue/rateLimiter.js';
import { STATIC_PROBLEMS } from './problems.js';

export async function executionActor(request, create = false) {
  return await authenticateRequest(request, { optional: true }) || guestActor(request.headers.get('cookie') || '', create);
}

export function executionError(error) {
  const status = error.message === 'QUEUE_FULL' ? 503 : error.status || 500;
  if (status === 500) console.error('Execution API failed:', error);
  return NextResponse.json({ success: false, error: status === 500 ? 'Internal server error' : error.message }, {
    status, headers: { 'Cache-Control': 'no-store', ...(status === 503 ? { 'Retry-After': '5' } : {}) },
  });
}

export async function enqueueExecution(request, type, payload, { submit = false } = {}) {
  validateExecution(payload);
  const actor = await executionActor(request, true);
  if (type === 'dynamic') await PracticalService.authorize(actor, payload.dbId, { submit });
  else if (submit && actor.role === 'guest') throw { status: 401, message: 'Authentication required' };
  const rate = await checkRateLimit(actor.role === 'guest' ? 'anonymous' : String(actor.id), submit ? 'submit' : 'run');
  if (!rate.allowed) throw { status: 429, message: 'Too many requests' };
  const userId = actor.role === 'guest' ? null : actor.id;
  const jobId = await SubmissionService.enqueueJob(type, { ...payload, userId, isSubmit: submit }, actor.id);
  const response = NextResponse.json({ success: true, jobId, status: 'queued' }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  if (actor.role === 'guest') response.cookies.set(GUEST_COOKIE, actor.cookie, {
    httpOnly: true, sameSite: 'lax', secure: new URL(request.url).protocol === 'https:', path: '/', maxAge: 86400,
  });
  return response;
}

export function practiceHandler(fixedLanguage = null, submit = false) {
  return async function POST(request) {
    try {
      let body;
      try { body = await request.json(); } catch { throw { status: 400, message: 'Invalid JSON payload' }; }
      if (!body || typeof body !== 'object') throw { status: 400, message: 'Invalid payload' };
      const { code, problemId } = body;
      const language = fixedLanguage || body.language || 'python';
      validateExecution({ code, language });
      const isPractical = (typeof problemId === 'string' && problemId.startsWith('practical_')) || (typeof problemId === 'number') || (/^\d+$/.test(String(problemId || '')));
      if (isPractical) {
        const rawId = typeof problemId === 'string' && problemId.startsWith('practical_')
          ? problemId.slice('practical_'.length)
          : String(problemId);
        if (/^\d+$/.test(rawId)) {
          return await enqueueExecution(request, 'dynamic', { language, code, dbId: Number(rawId) }, { submit });
        }
      }
      const problem = (Object.hasOwn(STATIC_PROBLEMS, problemId) ? STATIC_PROBLEMS[problemId] : null) || Object.values(STATIC_PROBLEMS).find(p => p.slug === problemId || p.id === Number(problemId));
      if (!problem || !Array.isArray(problem.testCases) || !problem.testCases.length) throw { status: 404, message: 'Problem not found' };
      const testCases = (problem.testCases || []).map(tc => ({ args: tc.args || [], kwargs: tc.kwargs || {}, expected: tc.expected }));
      return await enqueueExecution(request, 'practice', { code, language, problem, testCases }, { submit });
    } catch (error) { return executionError(error); }
  };
}
