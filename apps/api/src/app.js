import Fastify from 'fastify';
import operationsRoutes from './modules/operations/operations.routes.js';

export function buildApp(options = {}) {
  const app = Fastify({
    logger: false,
    ...options,
  });

  app.register(operationsRoutes, { prefix: '/api' });

  return app;
}
