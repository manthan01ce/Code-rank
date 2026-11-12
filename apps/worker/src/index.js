import '@coderank/core/config/env';
import { closeDatabase } from '@coderank/database';

import { createSubmissionWorker } from './jobs/execution/submission.worker.js';
import { createSystemWorker } from './jobs/system/system.worker.js';
import { logger } from '@coderank/core/shared/logger';
import { createShutdown } from './lifecycle/shutdown.js';
import { trackWorkerExecutions } from './lifecycle/analytics.js';
import { startExecutionHeartbeat } from './lifecycle/heartbeat.js';
import { startSandboxReaper, assertColdSandboxConfiguration } from '@coderank/runner/sandbox';

assertColdSandboxConfiguration();

console.log('⚡ CodeRank Execution Worker Starting...');

const { worker: submissionWorker, disconnectRealtime, timings } = createSubmissionWorker();
const systemWorker = createSystemWorker();
const analytics = trackWorkerExecutions(submissionWorker);
const heartbeat = startExecutionHeartbeat(submissionWorker, { observe: async () => ({...await analytics.observe(),timings:timings.state()}) });
const sandboxReaper = startSandboxReaper();

logger.info('CodeRank Worker initialized and listening to queues.');

const drain = createShutdown({ workers: [submissionWorker, systemWorker, { pause: () => { analytics.stop(); return Promise.all([heartbeat.stop(), sandboxReaper.stop()]); }, close: async () => {} }], socket: { disconnect: disconnectRealtime }, afterDrain: async () => { await timings.stop(); await closeDatabase(); } });
const shutdown = async () => process.exit(await drain());

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
