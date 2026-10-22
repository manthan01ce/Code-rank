import { Worker } from 'bullmq';
import { logger } from '@coderank/core/utils/logger';
import { checkDockerHealth } from '../execution/docker.js';

export function createSystemWorker() {
  const connection = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: null,
  };

  const worker = new Worker('system-tasks', async (job) => {
    const { task, data } = job.data;
    logger.info(`[SystemWorker] Processing system task: ${task}`, { taskId: job.id });

    if (task === 'health_check') {
      const docker = await checkDockerHealth();
      return { docker, timestamp: new Date().toISOString() };
    }

    if (task === 'log_event') {
      logger.info(data.message, data.meta || {});
      return { logged: true };
    }

    return { status: 'unknown_task' };
  }, {
    connection,
    concurrency: 2,
  });

  worker.on('error', error => logger.error('[SystemWorker] Queue error', { message: error.message }));
  return worker;
}
