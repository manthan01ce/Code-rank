import dotenv from 'dotenv';
dotenv.config();

import { createSubmissionWorker } from './workers/submission.worker.js';
import { createSystemWorker } from './workers/system.worker.js';
import { logger } from '@coderank/core/utils/logger';

console.log('⚡ CodeRank Execution Worker Starting...');

const { worker: submissionWorker, socket } = createSubmissionWorker();
const systemWorker = createSystemWorker();

logger.info('CodeRank Worker initialized and listening to queues.');

let shuttingDown = false;

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('Worker: SIGTERM/SIGINT received; pausing intake and draining active jobs...');

  // Stop acquiring new jobs first. BullMQ's close() then waits for any active
  // processor promises, so in-flight code execution is not abandoned.
  await Promise.all([
    submissionWorker.pause(true),
    systemWorker.pause(true),
  ]);

  const forcedExit = setTimeout(() => {
    console.error('Worker: graceful shutdown deadline exceeded; exiting.');
    process.exit(1);
  }, parseInt(process.env.SHUTDOWN_GRACE_MS || '45000', 10));
  forcedExit.unref();

  try {
    await submissionWorker.close();
    await systemWorker.close();
    socket.disconnect();
    console.log('Worker: active jobs drained; shutdown complete.');
    process.exit(0);
  } catch (error) {
    console.error('Worker: graceful shutdown failed:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
