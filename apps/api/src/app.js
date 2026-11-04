import Fastify from 'fastify';
import operationsRoutes from './modules/operations/operations.routes.js';
import { SubmissionService } from '@coderank/core/services/SubmissionService';
import { closeDatabase } from '@coderank/database';
import { closeRateLimiter } from './middleware/rate-limiter.js';
import authRoutes from './modules/auth/auth.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import realtimePlugin from './realtime/server.js';

export function buildApp(options = {}) {
  const app = Fastify({
    logger: false,
    ...options,
  });

  app.addHook('onClose', async () => {
    const outcomes = await Promise.allSettled([closeRateLimiter(), closeDatabase(), SubmissionService.close?.()]);
    const failed = outcomes.find(result => result.status === 'rejected');
    if (failed) throw failed.reason;
  });

  app.register(realtimePlugin, options.realtime || {});
  app.register(operationsRoutes, { prefix: '/api' });
  app.register(authRoutes, { prefix: '/api' });
  app.register(usersRoutes, { prefix: '/api' });

  return app;
}
