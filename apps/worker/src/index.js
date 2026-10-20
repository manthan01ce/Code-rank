import '../../../packages/core/src/config/env.js';

import { createSubmissionWorker } from './workers/submission.worker.js';
import { createSystemWorker } from './workers/system.worker.js';
import { logger } from '@coderank/core/utils/logger';
import { createShutdown } from './shutdown.js';
import { startExecutionHeartbeat } from './heartbeat.js';

console.log('⚡ CodeRank Execution Worker Starting...');

const { worker: submissionWorker, disconnectRealtime } = createSubmissionWorker();
const systemWorker = createSystemWorker();
const heartbeat = startExecutionHeartbeat(submissionWorker);

logger.info('CodeRank Worker initialized and listening to queues.');

const drain = createShutdown({ workers: [submissionWorker, systemWorker, { pause: () => heartbeat.stop(), close: async () => {} }], socket: { disconnect: disconnectRealtime } });
const shutdown = async () => process.exit(await drain());

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
