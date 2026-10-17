/**
 * apps/web/src/lib/queue/jobQueue.js
 *
 * Single queue producer for all execution types.
 * Jobs carry a UUID id so that ownership can be verified by the API layer.
 * Producer retries are bounded to 3; completed/failed job counts are bounded.
 */
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';

const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null,
};

const QUEUE_ADMISSION_LUA = `
  local wait_len = redis.call('LLEN', KEYS[1])
  local paused_len = redis.call('LLEN', KEYS[2])
  local total = wait_len + paused_len
  if total >= tonumber(ARGV[1]) then
    return 0
  end
  return 1
`;

let _codeExecutionQueue = null;

export function getExecutionQueue() {
  if (!_codeExecutionQueue) {
    _codeExecutionQueue = new Queue('code-execution', {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: { age: 3600, count: 500 },   // Keep max 500 jobs / 1 hour
        removeOnFail:    { age: 86400, count: 1000 },  // Keep max 1000 failed / 1 day
        attempts: 1,                                   // No retry for code execution
      },
    });
  }
  return _codeExecutionQueue;
}

export const codeExecutionQueue = new Proxy({}, {
  get(_target, prop) {
    return getExecutionQueue()[prop];
  }
});

/**
 * Enqueue a job and return a UUID job id.
 *
 * @param {string} type         - 'dynamic' | 'practice' | 'playground'
 * @param {object} payload      - language-specific payload
 * @param {number|null} userId  - authenticated user id, or null for anonymous
 * @param {string|null} anonSessionId - anonymous session id (from HttpOnly cookie)
 * @returns {Promise<string>}   - UUID job id
 */
export async function enqueueJob(type, payload, userId = null, anonSessionId = null) {
  const maxQueueSize = parseInt(process.env.MAX_QUEUE_SIZE || '500', 10);

  try {
    const client = await codeExecutionQueue.client;
    const allowed = await client.eval(
      QUEUE_ADMISSION_LUA,
      2,
      'bull:code-execution:wait',
      'bull:code-execution:paused',
      maxQueueSize
    );
    if (allowed === 0) {
      throw new Error('QUEUE_FULL');
    }
  } catch (err) {
    if (err.message === 'QUEUE_FULL') throw err;
    // Fallback if client.eval fails
    const waiting = await codeExecutionQueue.getWaitingCount();
    if (waiting >= maxQueueSize) {
      throw new Error('QUEUE_FULL');
    }
  }

  // Generate a UUID so the API can track ownership without leaking internal ids
  const jobUuid = randomUUID();

  await codeExecutionQueue.add(type, {
    type,
    payload,
    userId,
    anonSessionId,
    enqueuedAt: Date.now(),
  }, {
    // BullMQ job id must be a string; set it to our UUID
    jobId: jobUuid,
  });

  return jobUuid;
}

/**
 * Retrieve job status, redacting hidden-case data for the given caller.
 *
 * @param {string} jobId      - UUID job id
 * @param {object|null} caller - decoded JWT user from the request, or null
 * @param {string|null} anonSessionId - anonymous session id for ownership
 */
/**
 * Verify whether a caller owns a given job.
 * @param {object} jobData - job.data
 * @param {object|null} caller - decoded user { id, role }
 * @param {string|null} anonSessionId - anonymous session cookie
 * @returns {boolean}
 */
export function checkJobOwnership(jobData, caller = null, anonSessionId = null) {
  if (caller) {
    if (caller.role === 'faculty' || caller.role === 'admin') return true;
    return String(jobData.userId) === String(caller.id);
  }
  return !!(anonSessionId && jobData.anonSessionId === anonSessionId);
}

export async function getJobStatus(jobId, caller = null, anonSessionId = null) {
  const job = await codeExecutionQueue.getJob(jobId);
  if (!job) return null;

  if (!checkJobOwnership(job.data, caller, anonSessionId)) {
    return { forbidden: true };
  }

  const state = await job.getState();
  const result = job.returnvalue ? redactHiddenCases(job.returnvalue, caller) : null;

  return {
    jobId: job.id,
    status: state,
    result,
    failedReason: job.failedReason || null,
    enqueuedAt: job.data.enqueuedAt,
    processedOn: job.processedOn,
    finishedOn:  job.finishedOn,
  };
}

/**
 * Strip hidden test-case inputs, expected outputs, and actual outputs from a
 * job result before sending to a student caller.
 * Faculty and admin see the full result.
 */
export function redactHiddenCases(result, caller) {
  if (!result || !Array.isArray(result.cases)) return result;
  if (caller && (caller.role === 'faculty' || caller.role === 'admin')) return result;

  const cases = result.cases.map(tc => {
    if (!tc.is_hidden && !tc.hidden) return tc;
    return {
      ...tc,
      input:           '[hidden]',
      expected:        '[hidden]',
      expected_output: '[hidden]',
      actual:          tc.passed ? '[hidden — passed]' : '[hidden — failed]',
      actual_output:   tc.passed ? '[hidden — passed]' : '[hidden — failed]',
      stdout:          '',
      stderr:          '',
      error_message:   tc.passed ? null : 'Hidden test case failed',
    };
  });

  return { ...result, cases };
}
