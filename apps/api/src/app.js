import Fastify from 'fastify';
import operationsRoutes from './modules/operations/operations.routes.js';
import { closeDatabase } from '@coderank/database';
import { closeRateLimiter } from './middleware/rate-limiter.js';
import authRoutes from './modules/auth/auth.routes.js';

export function buildApp(options = {}) {
  const app = Fastify({
    logger: false,
    ...options,
  });

  app.addHook('onClose', async () => {
    const outcomes = await Promise.allSettled([closeRateLimiter(), closeDatabase()]);
    const failed = outcomes.find(result => result.status === 'rejected');
    if (failed) throw failed.reason;
  });
  app.register(operationsRoutes, { prefix: '/api' });
  app.register(authRoutes, { prefix: '/api' });

  return app;
}
