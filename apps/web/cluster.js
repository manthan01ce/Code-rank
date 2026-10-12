import cluster from 'cluster';
import os from 'os';
import { logger } from '@coderank/core/utils/logger';

const numCPUs = os.cpus().length;
const CLUSTER_ENABLED = process.env.CLUSTER_ENABLED !== 'false';
const isDev = process.env.NODE_ENV !== 'production';

// In development or when clustering is disabled, run single process
if (isDev || !CLUSTER_ENABLED) {
  logger.info('Running in single-process mode', { 
    reason: isDev ? 'development mode' : 'CLUSTER_ENABLED=false' 
  });
  
  // Import and run server directly
  await import('./server.js');
} else if (cluster.isPrimary) {
  // Primary process: fork workers
  logger.info('Starting CodeRank cluster', { 
    workers: numCPUs, 
    pid: process.pid 
  });

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Handle worker exits and restart them
  cluster.on('exit', (worker, code, signal) => {
    logger.warn('Worker process died, restarting', { 
      workerId: worker.id, 
      workerPid: worker.process.pid,
      code, 
      signal 
    });
    
    // Fork a new worker to replace the dead one
    cluster.fork();
  });

  // Log when workers come online
  cluster.on('online', (worker) => {
    logger.info('Worker started', { 
      workerId: worker.id, 
      workerPid: worker.process.pid 
    });
  });

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    
    for (const id in cluster.workers) {
      cluster.workers[id].kill();
    }
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    
    for (const id in cluster.workers) {
      cluster.workers[id].kill();
    }
    
    process.exit(0);
  });

} else {
  // Worker process: run the server
  await import('./server.js');
}
