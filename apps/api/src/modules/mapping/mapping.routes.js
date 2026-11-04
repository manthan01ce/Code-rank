import { MappingService } from './mapping.service.js';
import { requireActor } from '../../middleware/authentication.js';

export default async function mappingRoutes(fastify) {
  fastify.decorateRequest('actor', null);

  fastify.removeContentTypeParser('application/json');
  fastify.removeContentTypeParser('text/plain');
  const parseJson = (request, body, done) => {
    if ((body === '' || body === undefined) && ['DELETE', 'GET', 'HEAD'].includes(request.method)) {
      done(null, undefined);
      return;
    }
    try {
      done(null, JSON.parse(body));
    } catch {
      done(Object.assign(new Error('Invalid JSON payload'), { code: 'INVALID_JSON', statusCode: 400 }));
    }
  };
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, parseJson);
  fastify.addContentTypeParser('*', { parseAs: 'string' }, parseJson);

  fastify.addHook('onSend', async (request, reply, payload) => {
    reply.header('Cache-Control', 'no-store');
    return payload;
  });

  fastify.setErrorHandler((error, request, reply) => {
    const status = error.statusCode || error.status || 500;
    const invalidJson = error.code === 'INVALID_JSON' || error.code === 'FST_ERR_CTP_EMPTY_JSON_BODY';
    const message = invalidJson
      ? 'Invalid JSON payload'
      : status === 413 ? 'Request body is too large' : status < 500 ? error.message : 'Internal server error';
    reply.code(status).send({ error: message });
  });

  // GET /mapping — admin only
  // status: 200
  fastify.get('/mapping', { onRequest: requireActor }, async (request, reply) => {
    try {
      const user = request.actor;
      const result = await MappingService.list(user);
      return reply.send(result);
    } catch (error) {
      if (error.status) return reply.status(error.status).send({ error: error.message });
      console.error('GET /api/mapping error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /mapping — admin only
  // status: 200
  fastify.post('/mapping', { onRequest: requireActor }, async (request, reply) => {
    try {
      const user = request.actor;
      MappingService.admin(user);
      const body = request.body;
      if (body === undefined) return reply.code(400).send({ error: 'Invalid JSON payload' });
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return reply.status(400).send({ error: 'Expected a JSON object' });
      }
      const result = await MappingService.replace(user, body);
      return reply.send(result);
    } catch (error) {
      if (error.status) return reply.status(error.status).send({ error: error.message });
      console.error('POST /api/mapping error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  for (const [url, allowed] of [
    ['/mapping', ['GET', 'HEAD', 'POST']],
  ]) {
    fastify.route({
      method: 'OPTIONS',
      url,
      onRequest: async (request, reply) => reply.header('Allow', [...allowed, 'OPTIONS'].sort().join(', ')).code(204).send(),
      handler: async () => {},
    });
    fastify.route({
      method: ['DELETE', 'GET', 'HEAD', 'PATCH', 'POST', 'PUT'].filter(m => !allowed.includes(m)),
      url,
      onRequest: async (request, reply) => reply.code(405).send(),
      handler: async () => {},
    });
  }
}
