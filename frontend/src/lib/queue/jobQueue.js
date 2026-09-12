import { Queue } from 'bullmq';

const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null,
};

export const codeExecutionQueue = new Queue('code-execution', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: { age: 3600 },   // Keep for 1 hour
    removeOnFail: { age: 86400 },      // Keep failed jobs for 1 day
    attempts: 1,                       // No retry for code execution
    timeout: parseInt(process.env.JOB_TIMEOUT_MS || '30000', 10),
  },
});

export async function enqueueJob(type, payload, userId = null) {
  const waiting = await codeExecutionQueue.getWaitingCount();
  const maxQueueSize = parseInt(process.env.MAX_QUEUE_SIZE || '500', 10);
  
  if (waiting >= maxQueueSize) {
    throw new Error('QUEUE_FULL');
  }

  const job = await codeExecutionQueue.add(type, {
    type,
    payload,
    userId,
    enqueuedAt: Date.now(),
  });
  return job.id;
}

export async function getJobStatus(jobId) {
  const job = await codeExecutionQueue.getJob(jobId);
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
