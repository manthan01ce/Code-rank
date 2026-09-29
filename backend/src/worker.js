import './env-setup.js';
import { Worker } from 'bullmq';
import { closePool } from '@coderank/core';
import { runDynamicPractical } from './lib/execution/runDynamicPractical.js';
import { runPython } from './lib/execution/runPython.js';
import { runCpp } from './lib/execution/runCpp.js';
import { runC } from './lib/execution/runC.js';
import { runJava } from './lib/execution/runJava.js';
import { runJavaScript } from './lib/execution/runJavaScript.js';
import { io } from 'socket.io-client';

const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_JOBS || '2', 10);
const JOB_TIMEOUT = parseInt(process.env.JOB_TIMEOUT_MS || '30000', 10);

const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null,
};

// Connect back to our own server to emit Socket.IO events
const socket = io(`http://127.0.0.1:${process.env.PORT || 3000}`);

console.log(`Starting worker... Concurrency: ${MAX_CONCURRENT}`);

const worker = new Worker('code-execution', async (job) => {
  const { type, payload, userId } = job.data;
  console.log(`Processing job ${job.id} (type: ${type})`);

  let result;
  if (type === 'dynamic') {
    result = await runDynamicPractical(payload);
  } else if (type === 'playground') {
    const { executeCode } = await import('./lib/execution/index.js');
    result = await executeCode(payload.language, payload.code, payload.input);
  } else if (type === 'practice') {
    // Determine language and run standard static problem
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

  // Emit completion event to socket
  socket.emit('worker_job_complete', { jobId: job.id, result });

  return result;
}, {
  connection,
  concurrency: MAX_CONCURRENT,
  lockDuration: JOB_TIMEOUT + 5000,
});

// Graceful shutdown — close worker, socket, AND database pool
async function gracefulShutdown(signal) {
  console.log(`Worker: ${signal} received, closing...`);
  await worker.close();
  socket.disconnect();
  await closePool();
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed. Duration: ${job.finishedOn - job.processedOn}ms`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
  if (job) {
     socket.emit('worker_job_complete', { 
       jobId: job.id, 
       result: { 
         status: 'internal_error', 
         summary: 'Execution failed internally', 
         runtimeError: err.message 
       } 
     });
  }
});

worker.on('stalled', (jobId) => {
  console.warn(`Job ${jobId} stalled`);
});

