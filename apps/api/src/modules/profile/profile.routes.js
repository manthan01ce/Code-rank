import { ProfileService } from './profile.service.js';
import { requireActor } from '../../middleware/authentication.js';

export default async function profileRoutes(fastify) {
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
      done(Object.assign(new Error('Invalid profile payload'), { code: 'PROFILE_INVALID_JSON', statusCode: 400 }));
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
    const invalidJson = error.code === 'PROFILE_INVALID_JSON' || error.code === 'FST_ERR_CTP_EMPTY_JSON_BODY';
    const message = invalidJson
      ? 'Invalid profile payload'
      : status === 413
        ? 'Request body is too large'
        : status < 500
          ? error.message
          : 'Internal server error';
    reply.header('Cache-Control', 'no-store').code(status).send({ error: message });
  });

  // GET /profile/:username — public username profile lookup
  fastify.get('/profile/:username', { onRequest: requireActor }, async (request, reply) => {
    try {
      const result = await ProfileService.getProfileByUsername(request.actor, request.params.username);
      reply.header('Cache-Control', 'no-store');
      return reply.status(200).send(result);
    } catch (error) {
      reply.header('Cache-Control', 'no-store');
      const status = error.status || error.statusCode || 500;
      if (status === 500) console.error('GET /api/profile/[username] error:', error);
      return reply.status(status).send({ error: error.status ? error.message : 'Internal server error' });
    }
  });

  // PUT /profile/:username — update caller profile
  fastify.put('/profile/:username', { onRequest: requireActor }, async (request, reply) => {
    const body = request.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      reply.header('Cache-Control', 'no-store');
      return reply.status(400).send({ error: 'Invalid profile payload' });
    }

    try {
      const result = await ProfileService.updateProfile(request.actor, body);
      reply.header('Cache-Control', 'no-store');
      return reply.status(200).send(result);
    } catch (error) {
      reply.header('Cache-Control', 'no-store');
      const status = error.status || error.statusCode || 500;
      if (status === 500) console.error('PUT /api/profile/[username] error:', error);
      return reply.status(status).send({ error: error.status ? error.message : 'Internal server error' });
    }
  });

  // OPTIONS and 405 Method Not Allowed handling
  fastify.route({
    method: 'OPTIONS',
    url: '/profile/:username',
    onRequest: async (request, reply) =>
      reply.header('Allow', 'GET, HEAD, OPTIONS, PUT').code(204).send(),
    handler: async () => {},
  });

  fastify.route({
    method: ['POST', 'DELETE', 'PATCH'],
    url: '/profile/:username',
    onRequest: async (request, reply) =>
      reply
        .header('Allow', 'GET, HEAD, OPTIONS, PUT')
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
