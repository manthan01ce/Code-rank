import { PracticalService } from '../practicals/PracticalService.js';
import { ALLOWED_LANGUAGES } from '../../security/execution.js';
import sql from '../../db/client.js';
import { createExecutionQueue, readExecutionWorkers } from '@coderank/queue';
import { randomUUID } from 'node:crypto';
import { canReadJob, publicCase, publicResult } from '../../security/execution.js';

const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  retryStrategy: attempts => attempts > 3 ? null : Math.min(attempts * 250, 1000),
};

// BullMQ Queue instance
let codeExecutionQueue = null;
let queueStatsCache = null;
let queueStatsCacheAt = 0;
let queueStatsPromise = null;
const QUEUE_STATS_TTL_MS = 1000;

function getExecutionQueue() {
  if (!codeExecutionQueue) {
    codeExecutionQueue = createExecutionQueue(redisConnection);
  }
  return codeExecutionQueue;
}

export class SubmissionService {
  /**
   * Enqueue a job into BullMQ
   */
  static async enqueueJob(type, payload, userId = null) {
    const queue = getExecutionQueue();
    let job;
    try { job = await queue.add(type, {
      type,
      payload,
      userId,
      enqueuedAt: Date.now(),
    }, { jobId: randomUUID() });

    } catch (error) {
      if (error.message?.includes('OWNER_QUEUE_FULL')) throw { status: 429, message: 'Too many pending jobs for this account' };
      if (error.message?.includes('QUEUE_FULL')) throw { status: 503, message: 'QUEUE_FULL' };
      throw error;
    }
    return job.id;
  }

  /**
   * Get job status and results
   */
  static async getJobStatus(jobId, actor) {
    const queue = getExecutionQueue();
    const job = await queue.getJob(jobId);
    if (!job) return null;
    if (!canReadJob(job, actor)) throw { status: 403, message: 'Job access denied' };
    const state = await job.getState();
    return {
      jobId: job.id,
      status: state,
      result: publicResult(job.returnvalue || null),
      failedReason: job.failedReason ? 'Execution failed internally' : null,
      enqueuedAt: job.data.enqueuedAt,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    };
  }

  /**
   * Get queue statistics with caching for better performance
   */
  static async getWorkerStatus() { return readExecutionWorkers(getExecutionQueue()); }

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
    if (!user || (user.role !== 'faculty' && user.role !== 'student' && user.role !== 'admin')) {
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

    // Faculty must be assigned to the practical's course; admins bypass ownership check
    if (user.role === 'faculty') {
      const mapping = await sql`
        SELECT 1 FROM course_faculty cf
        JOIN practicals p ON p.course_id = cf.course_id
        WHERE p.id = ${submission.practical_id} AND cf.faculty_id = ${user.id}
      `;
      if (mapping.length === 0) {
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
      cases: user.role === 'student' ? cases.map(publicCase) : cases
    };
  }

  /**
   * Delete submission (faculty only)
   */
  static async deleteSubmission(user, id) {
    if (!user || (user.role !== 'faculty' && user.role !== 'admin')) throw {status:401,message:'Unauthorized: Only faculty or admins can delete submissions.'};
    const subId=Number(id);
    if(!Number.isSafeInteger(subId)||subId<=0)throw {status:400,message:'Invalid submission ID'};
    try {
      const [row]=await sql.query('SELECT coderank_reset_submission($1,$2) AS result',[user.id,subId]);
      return row.result;
    }catch(error){
      if(error.code==='42501')throw {status:403,message:'Current course assignment required'};
      if(error.code==='P0002')throw {status:404,message:'Submission not found'};
      throw error;
    }
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
    const practicalId = Number(pId);
    if (!Number.isSafeInteger(practicalId) || practicalId <= 0) throw { status: 400, message: 'Invalid practical_id' };
    await PracticalService.authorize(user, practicalId);
    if (language && !ALLOWED_LANGUAGES.has(language)) throw { status: 400, message: 'Invalid language' };

    if (typeof code !== 'string' || Buffer.byteLength(code, 'utf8') > 128 * 1024 || !language) throw { status: 400, message: 'Invalid workspace code or language' };
    await sql`
      INSERT INTO student_workspaces (student_id, practical_id, language, latest_code, saved_at)
      VALUES (${user.id}, ${practicalId}, ${language}, convert_to(${code}, 'UTF8'), NOW())
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
    const practicalId = Number(pId);
    if (!Number.isSafeInteger(practicalId) || practicalId <= 0) throw { status: 400, message: 'Invalid practical_id' };
    await PracticalService.authorize(user, practicalId);
    if (language && !ALLOWED_LANGUAGES.has(language)) throw { status: 400, message: 'Invalid language' };

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
