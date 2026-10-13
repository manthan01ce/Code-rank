import cluster from 'cluster';
import os from 'os';
import { logger } from '@coderank/core/utils/logger';

// `npm run start` is the production entrypoint on every platform. Set this
// before importing server.js so Next resolves the production build correctly.
process.env.NODE_ENV ||= 'production';

const numCPUs = os.cpus().length;
// Socket.IO rooms are process-local. Do not create a cluster until a shared
// adapter and sticky-session routing are configured, otherwise completion
// events can be delivered to a different process than the connected client.
const requestedCluster = process.env.CLUSTER_ENABLED === 'true';
const socketAdapterConfigured = process.env.SOCKET_IO_ADAPTER === 'redis';
const CLUSTER_ENABLED = requestedCluster && socketAdapterConfigured;
const isDev = process.env.NODE_ENV !== 'production';

// In development, only enable clustering if explicitly requested
if (!CLUSTER_ENABLED) {
  logger.info('Running in single-process mode', { 
    reason: requestedCluster
      ? 'Socket.IO Redis adapter/sticky-session routing is not configured'
      : 'CLUSTER_ENABLED not set to true',
    mode: isDev ? 'development' : 'production'
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
