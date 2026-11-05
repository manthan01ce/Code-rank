import { publicResult } from '@coderank/core/security/execution';
import { Worker } from 'bullmq';
import { jobLifetime } from '@coderank/runner/sandbox';
import { dispatchExecution } from './dispatch.js';
import { createWorkerPublisher } from '../../realtime/publisher.js';

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

  const publisher = createWorkerPublisher();
  const { socket, disconnectRealtime } = publisher;

  console.log(`[SubmissionWorker] Starting... Concurrency: ${MAX_CONCURRENT}`);

  const worker = new Worker('code-execution', async (job) => {
    const { type, payload, userId } = job.data;
    if (verboseLogs) console.log(`[SubmissionWorker] Processing job ${job.id} (type: ${type})`);

    const result = await dispatchExecution(job);
    return publicResult(result);
  }, {
    connection,
    concurrency: MAX_CONCURRENT,
    lockDuration: JOB_TIMEOUT + 5000,
  });

  worker.on('completed', async (job, result) => {
    await publisher.completed(job, result);
    if (verboseLogs) console.log(`[SubmissionWorker] Job ${job.id} completed. Duration: ${job.finishedOn - job.processedOn}ms`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[SubmissionWorker] Job ${job?.id} failed:`, err.message);
    if (job) {
      publisher.failed(job);
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
