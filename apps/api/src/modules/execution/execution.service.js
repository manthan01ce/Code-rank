import { authenticateRequest } from '@coderank/core/security/active-actor';
import { guestActor, GUEST_COOKIE, ALLOWED_LANGUAGES, validateExecution } from '@coderank/core/security/execution';
import { PracticalService } from '@coderank/core/services/PracticalService';
import { STATIC_PROBLEMS } from '@coderank/contracts/practice';
import { SubmissionService } from '@coderank/core/services/SubmissionService';
import { checkRateLimit } from '../../middleware/rate-limiter.js';

export class ExecutionService {
  static async getExecutionActor(request, create = false) {
    const actor = await authenticateRequest(request, { optional: true });
    if (actor) return actor;
    const cookieHeader = typeof request.headers?.get === 'function'
      ? (request.headers.get('cookie') || '')
      : (request.headers?.cookie || '');
    return guestActor(cookieHeader, create);
  }

  static async enqueueExecution({ request, actor, type, payload, submit = false }) {
    validateExecution(payload);
    if (!actor) {
      actor = await ExecutionService.getExecutionActor(request, true);
    }
    if (type === 'dynamic') {
      await PracticalService.authorize(actor, payload.dbId, { submit });
    } else if (submit && actor?.role === 'guest') {
      throw { status: 401, message: 'Authentication required' };
    }

    const rate = await checkRateLimit(actor?.role === 'guest' ? 'anonymous' : String(actor?.id || 'anonymous'), submit ? 'submit' : 'run');
    if (!rate.allowed) {
      throw { status: 429, message: 'Too many requests' };
    }

    const userId = actor?.role === 'guest' ? null : actor?.id;
    const jobId = await SubmissionService.enqueueJob(type, { ...payload, userId, isSubmit: submit }, actor?.id);

    return { jobId, status: 'queued', actor };
  }

  static async handlePracticeExecution({ request, actor, body, fixedLanguage = null, submit = false }) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw { status: 400, message: 'Invalid payload' };
    }

    const { code, problemId } = body;
    const language = fixedLanguage || body.language || 'python';
    validateExecution({ code, language });

    const isPractical = (typeof problemId === 'string' && problemId.startsWith('practical_')) || (typeof problemId === 'number') || (/^\d+$/.test(String(problemId || '')));
    if (isPractical) {
      const rawId = typeof problemId === 'string' && problemId.startsWith('practical_')
        ? problemId.slice('practical_'.length)
        : String(problemId);
      if (/^\d+$/.test(rawId)) {
        return await ExecutionService.enqueueExecution({
          request,
          actor,
          type: 'dynamic',
          payload: { language, code, dbId: Number(rawId) },
          submit,
        });
      }
    }

    const problem = (Object.hasOwn(STATIC_PROBLEMS, problemId) ? STATIC_PROBLEMS[problemId] : null) || Object.values(STATIC_PROBLEMS).find(p => p.slug === problemId || p.id === Number(problemId));
    if (!problem || !Array.isArray(problem.testCases) || !problem.testCases.length) {
      throw { status: 404, message: 'Problem not found' };
    }

    const testCases = (problem.testCases || []).map(tc => ({
      args: tc.args || [],
      kwargs: tc.kwargs || {},
      expected: tc.expected,
    }));

    return await ExecutionService.enqueueExecution({
      request,
      actor,
      type: 'practice',
      payload: { code, language, problem, testCases },
      submit,
    });
  }

  static async getJobStatus(jobId, actor) {
    if (!jobId) {
      throw { status: 400, message: 'jobId is required' };
    }
    return await SubmissionService.getJobStatus(jobId, actor);
  }

  static async getQueueStats() {
    return await SubmissionService.getQueueStats();
  }
}
