import { OperationsService } from './operations.service.js';
import { requireAdmin } from '../../middleware/authentication.js';

export default async function operationsRoutes(fastify) {
  fastify.decorateRequest('actor', null);

  fastify.addHook('onResponse', async (request, reply) => {
    OperationsService.recordHttpRequest({
      url: request.raw.url,
      statusCode: reply.statusCode,
      durationMs: reply.elapsedTime,
    });
  });

  // GET /live — public, dependency-free liveness probe
  fastify.get('/live', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    return reply.status(200).send({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  // GET /health — public readiness probe with in-memory cache
  fastify.get('/health', async (request, reply) => {
    const res = await OperationsService.getHealth();
    reply.header('Cache-Control', 'no-store');
    if (res.cacheHeader) reply.header('X-Cache', res.cacheHeader);
    return reply.status(res.status).send(res.data);
  });

  // GET /health/detailed — admin diagnostics
  fastify.get('/health/detailed', async (request, reply) => {
    await requireAdmin(request, reply);
    if (reply.sent) return;

    try {
      const res = await OperationsService.getDetailedHealth(request.actor);
      reply.header('Cache-Control', 'no-store');
      if (res.cacheHeader) reply.header('X-Cache', res.cacheHeader);
      return reply.status(200).send(res.data);
    } catch (error) {
      reply.header('Cache-Control', 'no-store');
      const status = error.status || error.statusCode || 500;
      if (status === 500) {
        console.error('[/api/health/detailed] Error:', error);
        return reply.status(500).send({
          timestamp: new Date().toISOString(),
          error: 'Failed to retrieve detailed health status',
          message: 'Internal server error',
        });
      }
      return reply.status(status).send({ error: error.message });
    }
  });

  // GET /logs — admin audit logs
  fastify.get('/logs', async (request, reply) => {
    await requireAdmin(request, reply);
    if (reply.sent) return;

    try {
      const logs = await OperationsService.getLogs(request.actor, request.query?.limit);
      reply.header('Cache-Control', 'no-store');
      return reply.status(200).send(logs);
    } catch (error) {
      reply.header('Cache-Control', 'no-store');
      const status = error.status || error.statusCode || 500;
      if (status === 500) console.error('API operation failed:', error);
      return reply.status(status).send({ error: error.status ? error.message : 'Internal server error' });
    }
  });

  // GET /metrics — admin operational metrics
  fastify.get('/metrics', async (request, reply) => {
    await requireAdmin(request, reply);
    if (reply.sent) return;

    try {
      const metrics = OperationsService.getHttpMetrics(request.actor);
      reply.header('Cache-Control', 'no-store');
      return reply.status(200).send(metrics);
    } catch (error) {
      reply.header('Cache-Control', 'no-store');
      const status = error.status || error.statusCode || 500;
      return reply.status(status).send({ error: error.status ? error.message : 'Internal server error' });
    }
  });

  // GET /queue/stats — public execution queue stats
  fastify.get('/queue/stats', async (request, reply) => {
    const res = await OperationsService.getQueueStats();
    if (res.cacheControl) reply.header('Cache-Control', res.cacheControl);
    if (res.cacheHeader) reply.header('X-Cache', res.cacheHeader);
    return reply.status(res.status).send(res.data);
  });

  // GET /stats — admin system and user counters
  fastify.get('/stats', async (request, reply) => {
    await requireAdmin(request, reply);
    if (reply.sent) return;

    try {
      const stats = await OperationsService.getStats(request.actor);
      reply.header('Cache-Control', 'no-store');
      return reply.status(200).send(stats);
    } catch (error) {
      reply.header('Cache-Control', 'no-store');
      const status = error.status || error.statusCode || 500;
      if (status === 500) console.error('Stats fetch error:', error);
      return reply.status(status).send({ error: error.status ? error.message : 'Internal server error' });
    }
  });

  // OPTIONS and 405 Method Not Allowed handling
  const endpoints = ['/live', '/health', '/health/detailed', '/logs', '/metrics', '/queue/stats', '/stats'];
  for (const url of endpoints) {
    fastify.route({
      method: 'OPTIONS',
      url,
      onRequest: async (request, reply) =>
        reply.header('Allow', 'GET, HEAD, OPTIONS').code(204).send(),
      handler: async () => {},
    });
    fastify.route({
      method: ['POST', 'PUT', 'DELETE', 'PATCH'],
      url,
      onRequest: async (request, reply) =>
        reply
          .header('Allow', 'GET, HEAD, OPTIONS')
          .header('Cache-Control', 'no-store')
          .code(405)
          .send({
            statusCode: 405,
            error: 'Method Not Allowed',
            message: `Method ${request.method} not allowed`,
          }),
      handler: async () => {},
    });
  }
}
