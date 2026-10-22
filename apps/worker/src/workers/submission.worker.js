import { createServiceToken } from '@coderank/core/security/service-token';
import { publicResult } from '@coderank/core/security/execution';
import { Worker } from 'bullmq';
import { io } from 'socket.io-client';
import { jobLifetime } from '@coderank/runner/sandbox';
import {
  runDynamicPractical,
  runPython,
  runCpp,
  runC,
  runJava,
  runJavaScript,
  executeCode
} from '../execution/runners/index.js';

export function createSubmissionWorker() {
  const configuredConcurrency = Number(process.env.MAX_CONCURRENT_JOBS || 8);
  if (!Number.isInteger(configuredConcurrency) || configuredConcurrency < 1 || configuredConcurrency > 64) throw new Error('MAX_CONCURRENT_JOBS must be an integer between 1 and 64');
  const MAX_CONCURRENT = configuredConcurrency;
  const JOB_TIMEOUT = jobLifetime();
  const verboseLogs = process.env.WORKER_VERBOSE_LOGS === 'true';

  const connection = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: null,
  };

  const socket = io(process.env.REALTIME_URL || `http://127.0.0.1:${process.env.PORT || 3000}`, { transports: ['websocket'], auth: callback => callback({ serviceToken: createServiceToken() }) });
  let realtimeClosed = false;
  socket.on('disconnect', reason => {
    // Socket.IO does not reconnect an explicit server disconnect. A fresh
    // connection runs the auth callback again and replaces an expired token.
    // Authentication rejection raises connect_error, which we do not retry here.
    if (reason === 'io server disconnect' && !realtimeClosed) socket.connect();
  });
  const disconnectRealtime = () => { realtimeClosed = true; socket.disconnect(); };

  console.log(`[SubmissionWorker] Starting... Concurrency: ${MAX_CONCURRENT}`);

  const worker = new Worker('code-execution', async (job) => {
    const { type, payload, userId } = job.data;
    if (verboseLogs) console.log(`[SubmissionWorker] Processing job ${job.id} (type: ${type})`);

    let result;
    if (type === 'dynamic') {
      result = await runDynamicPractical({ ...payload, userId, jobId: job.id, enqueuedAt: job.data.enqueuedAt || job.timestamp });
    } else if (type === 'playground') {
      result = await executeCode(payload.language, payload.code, payload.input);
    } else if (type === 'practice') {
      const { language } = payload;
      if (language === 'python') result = await runPython(payload);
      else if (language === 'cpp') result = await runCpp(payload);
      else if (language === 'c') result = await runC(payload);
      else if (language === 'java') result = await runJava(payload);
      else if (language === 'javascript') result = await runJavaScript(payload);
      else throw new Error(`Unsupported practice language: ${language}`);
    } else {
      throw new Error(`Unknown job type: ${type}`);
    }

    return publicResult(result);
  }, {
    connection,
    concurrency: MAX_CONCURRENT,
    lockDuration: JOB_TIMEOUT + 5000,
  });

  worker.on('completed', (job, result) => {
    socket.emit('worker_job_complete', { jobId: job.id, result: publicResult(result) });
    if (verboseLogs) console.log(`[SubmissionWorker] Job ${job.id} completed. Duration: ${job.finishedOn - job.processedOn}ms`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[SubmissionWorker] Job ${job?.id} failed:`, err.message);
    if (job) {
      socket.emit('worker_job_complete', { 
        jobId: job.id, 
        result: { 
          status: 'internal_error', 
          summary: 'Execution failed internally', 
          runtimeError: 'Execution failed internally'
        } 
      });
    }
  });

  worker.on('stalled', (jobId) => {
    console.warn(`[SubmissionWorker] Job ${jobId} stalled`);
  });
  // BullMQ emits connection errors outside processor promises. Keep a listener
  // so a temporary Redis outage does not become an unhandled EventEmitter error.
  worker.on('error', error => console.error('[SubmissionWorker] Queue error:', error.message));

  return { worker, socket, disconnectRealtime };
}
