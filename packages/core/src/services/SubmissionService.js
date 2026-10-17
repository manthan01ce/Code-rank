import sql from '../db/client.js';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';

const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null,
};

// BullMQ Queue instance
let codeExecutionQueue = null;
let queueStatsCache = null;
let queueStatsCacheAt = 0;
let queueStatsPromise = null;
const QUEUE_STATS_TTL_MS = 1000;

function getExecutionQueue() {
  if (!codeExecutionQueue) {
    codeExecutionQueue = new Queue('code-execution', {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: { age: 3600, count: 500 },
        removeOnFail: { age: 86400, count: 1000 },
        attempts: 1,
        timeout: parseInt(process.env.JOB_TIMEOUT_MS || '30000', 10),
      },
    });
  }
  return codeExecutionQueue;
}

const QUEUE_ADMISSION_LUA = `
  local wait_len = redis.call('LLEN', KEYS[1])
  local paused_len = redis.call('LLEN', KEYS[2])
  local total = wait_len + paused_len
  if total >= tonumber(ARGV[1]) then
    return 0
  end
  return 1
`;

export class SubmissionService {
  /**
   * Enqueue a job into BullMQ
   */
  static async enqueueJob(type, payload, userId = null, anonSessionId = null) {
    const queue = getExecutionQueue();
    const maxQueueSize = parseInt(process.env.MAX_QUEUE_SIZE || '500', 10);

    try {
      const client = await queue.client;
      const allowed = await client.eval(
        QUEUE_ADMISSION_LUA,
        2,
        'bull:code-execution:wait',
        'bull:code-execution:paused',
        maxQueueSize
      );
      if (allowed === 0) {
        throw { status: 503, message: 'QUEUE_FULL' };
      }
    } catch (err) {
      if (err.status === 503 || err.message === 'QUEUE_FULL') {
        throw { status: 503, message: 'QUEUE_FULL' };
      }
      const waiting = await queue.getWaitingCount();
      if (waiting >= maxQueueSize) {
        throw { status: 503, message: 'QUEUE_FULL' };
      }
    }

    const jobUuid = randomUUID();
    await queue.add(type, {
      type,
      payload,
      userId,
      anonSessionId,
      enqueuedAt: Date.now(),
    }, { jobId: jobUuid });

    return jobUuid;
  }

  /**
   * Get job status and results
   */
  static async getJobStatus(jobId) {
    const queue = getExecutionQueue();
    const job = await queue.getJob(jobId);
    if (!job) return null;
    const state = await job.getState();
    return {
      jobId: job.id,
      status: state,
      result: job.returnvalue || null,
      failedReason: job.failedReason || null,
      enqueuedAt: job.data.enqueuedAt,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    };
  }

  /**
   * Get queue statistics with caching for better performance
   */
  static async getQueueStats() {
    const now = Date.now();
    if (queueStatsCache && now - queueStatsCacheAt < QUEUE_STATS_TTL_MS) {
      return queueStatsCache;
    }
    if (queueStatsPromise) return queueStatsPromise;

    const queue = getExecutionQueue();
    const timeout = (ms) => new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), ms)
    );

    queueStatsPromise = (async () => {
      try {
        const [waiting, active] = await Promise.race([
          Promise.all([queue.getWaitingCount(), queue.getActiveCount()]),
          timeout(800),
        ]);
        queueStatsCache = { waiting, active, completed: 0, failed: 0, delayed: 0 };
        queueStatsCacheAt = Date.now();
        return queueStatsCache;
      } catch {
        // Preserve the last known value when Redis is slow rather than
        // presenting an empty queue as an authoritative value.
        return queueStatsCache
          ? { ...queueStatsCache, cached: true }
          : { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, cached: true };
      } finally {
        queueStatsPromise = null;
      }
    })();

    return queueStatsPromise;
  }

  /**
   * Get submission details
   */
  static async getSubmission(user, id) {
    if (!user || (user.role !== 'faculty' && user.role !== 'student')) {
      throw { status: 401, message: 'Unauthorized' };
    }

    const submissions = await sql`
      SELECT s.*, u.name as student_name, u.email as student_email,
             p.title as practical_title, p.total_marks as practical_total_marks, p.faculty_id
      FROM practical_submissions s
      JOIN users u ON s.student_id = u.id
      JOIN practicals p ON s.practical_id = p.id
      WHERE s.id = ${parseInt(id)}
    `;

    if (submissions.length === 0) {
      throw { status: 404, message: 'Submission not found' };
    }

    const submission = submissions[0];

    if (user.role === 'faculty') {
      const mapping = await sql`
        SELECT 1 FROM course_faculty cf
        JOIN practicals p ON p.course_id = cf.course_id
        WHERE p.id = ${submission.practical_id} AND cf.faculty_id = ${user.id}
      `;
      if (mapping.length === 0 && Number(submission.faculty_id) !== Number(user.id)) {
        throw { status: 403, message: 'Unauthorized: You are not assigned to this course.' };
      }
    }
    if (user.role === 'student' && submission.student_id !== user.id) {
      throw { status: 403, message: 'Unauthorized' };
    }

    const cases = await sql`
      SELECT sc.*, tc.input, tc.expected, tc.is_hidden, tc.label
      FROM practical_submission_cases sc
      JOIN practical_test_cases tc ON sc.test_case_id = tc.id
      WHERE sc.submission_id = ${parseInt(id)}
      ORDER BY tc.order_index ASC
    `;

    return {
      ...submission,
      cases
    };
  }

  /**
   * Delete submission (faculty only)
   */
  static async deleteSubmission(user, id) {
    if (!user || user.role !== 'faculty') {
      throw { status: 401, message: 'Unauthorized: Only faculty can delete submissions.' };
    }

    const subId = parseInt(id);
    const submissions = await sql`
      SELECT s.*, p.title as practical_title, p.faculty_id
      FROM practical_submissions s
      JOIN practicals p ON s.practical_id = p.id
      WHERE s.id = ${subId}
    `;

    if (submissions.length === 0) {
      throw { status: 404, message: 'Submission not found' };
    }

    const submission = submissions[0];
    const mapping = await sql`
      SELECT 1 FROM course_faculty cf
      JOIN practicals p ON p.course_id = cf.course_id
      WHERE p.id = ${submission.practical_id} AND cf.faculty_id = ${user.id}
    `;
    if (mapping.length === 0 && Number(submission.faculty_id) !== Number(user.id)) {
      throw { status: 403, message: 'Unauthorized: You are not assigned to this course.' };
    }

    const studentId = submission.student_id;
    const practicalId = submission.practical_id;

    await sql`DELETE FROM practical_submission_cases WHERE submission_id IN (SELECT id FROM practical_submissions WHERE student_id = ${studentId} AND practical_id = ${practicalId})`;
    await sql`DELETE FROM practical_submissions WHERE student_id = ${studentId} AND practical_id = ${practicalId}`;
    await sql`DELETE FROM student_workspaces WHERE student_id = ${studentId} AND practical_id = ${practicalId}`;

    try {
      await sql`
        INSERT INTO activity_logs (user_id, action, details)
        VALUES (${user.id}, 'DELETE_SUBMISSION', ${JSON.stringify({
          submission_id: subId,
          student_id: submission.student_id,
          practical_id: submission.practical_id,
          practical_title: submission.practical_title
        })})
      `;
    } catch (logErr) {
      console.warn('Could not write activity log:', logErr);
    }

    return { success: true, message: 'Submission deleted successfully' };
  }

  /**
   * Save workspace code for a student
   */
  static async saveWorkspace(user, { practical_id, code, language }) {
    if (!user || user.role !== 'student') {
      throw { status: 401, message: 'Unauthorized' };
    }

    let pId = practical_id;
    if (typeof pId === 'string' && pId.startsWith('practical_')) {
      pId = pId.replace('practical_', '');
    }
    const practicalId = parseInt(pId, 10);

    await sql`
      INSERT INTO student_workspaces (student_id, practical_id, language, latest_code, saved_at)
      VALUES (${user.id}, ${practicalId}, ${language}, ${code}, NOW())
      ON CONFLICT (student_id, practical_id, language)
      DO UPDATE SET latest_code = EXCLUDED.latest_code, saved_at = NOW()
    `;

    return { success: true };
  }

  /**
   * Load workspace code for a student
   */
  static async loadWorkspace(user, practical_id, language = null) {
    if (!user || user.role !== 'student') {
      throw { status: 401, message: 'Unauthorized' };
    }

    let pId = practical_id;
    if (typeof pId === 'string' && pId.startsWith('practical_')) {
      pId = pId.replace('practical_', '');
    }
    const practicalId = parseInt(pId, 10);

    let rows;
    if (language) {
      rows = await sql`
        SELECT convert_from(latest_code, 'UTF8') as code, language, saved_at 
        FROM student_workspaces 
        WHERE student_id = ${user.id} AND practical_id = ${practicalId} AND language = ${language}
        ORDER BY saved_at DESC LIMIT 1
      `;
    } else {
      rows = await sql`
        SELECT convert_from(latest_code, 'UTF8') as code, language, saved_at 
        FROM student_workspaces 
        WHERE student_id = ${user.id} AND practical_id = ${practicalId}
        ORDER BY saved_at DESC LIMIT 1
      `;
    }

    if (rows.length === 0) {
      return { code: '', latest_code: '', language: language || 'python' };
    }

    const codeStr = rows[0].code || '';
    return {
      code: codeStr,
      latest_code: codeStr,
      language: rows[0].language,
      saved_at: rows[0].saved_at
    };
  }
}
