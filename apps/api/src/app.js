import Fastify from 'fastify';
import operationsRoutes from './modules/operations/operations.routes.js';
import authRoutes from './modules/auth/auth.routes.js';

export function buildApp(options = {}) {
  const app = Fastify({
    logger: false,
    ...options,
  });

  app.register(operationsRoutes, { prefix: '/api' });
  app.register(authRoutes, { prefix: '/api' });

  return app;
}
