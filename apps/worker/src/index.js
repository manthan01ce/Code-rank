import dotenv from 'dotenv';
dotenv.config();

import { createSubmissionWorker } from './queue/submission.worker.js';
import { createSystemWorker } from './queue/system.worker.js';
import { logger } from '@coderank/core/utils/logger';

console.log('⚡ CodeRank Execution Worker Starting...');

const { worker: submissionWorker, socket } = createSubmissionWorker();
const systemWorker = createSystemWorker();

logger.info('CodeRank Worker initialized and listening to queues.');

async function shutdown() {
  console.log('Worker: SIGTERM/SIGINT received, shutting down gracefully...');
  await submissionWorker.close();
  await systemWorker.close();
  socket.disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
