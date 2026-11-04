import { requestTiming } from '@coderank/core/utils/request-timing';
import { AuthService } from './auth.service.js';
import { requireActor } from '../../middleware/authentication.js';
import { checkRateLimit } from '../../middleware/rate-limiter.js';

export default async function authRoutes(fastify) {
  fastify.decorateRequest('actor', null);
  // Auth accepts JSON independently of the browser's Content-Type, matching
  // Request.json(). Keep parser/error mapping scoped to this feature plugin.
  fastify.removeContentTypeParser('application/json');
  fastify.removeContentTypeParser('text/plain');
  const parseJson = (request, body, done) => {
    try { done(null, JSON.parse(body)); }
    catch { done(Object.assign(new Error('Invalid JSON'), { code: 'AUTH_INVALID_JSON', statusCode: 400 })); }
  };
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, parseJson);
  fastify.addContentTypeParser('*', { parseAs: 'string' }, parseJson);
  fastify.addHook('onSend', async (request, reply, payload) => {
    reply.header('Cache-Control', 'no-store');
    return payload;
  });
  fastify.setErrorHandler((error, request, reply) => {
    const status = error.statusCode || error.status || 500;
    const invalidJson = error.code === 'AUTH_INVALID_JSON' || error.code === 'FST_ERR_CTP_EMPTY_JSON_BODY';
    const message = invalidJson
      ? (request.url.split('?')[0] === '/api/auth/login' ? 'Invalid JSON' : 'Invalid JSON payload')
      : status === 413 ? 'Request body is too large' : status < 500 ? error.message : 'Internal server error';
    reply.code(status).send({ error: message });
  });

  // POST /auth/login — public, rate-limited
  // status: 200, 400, 401, 429, 500, 503
  // 'Cache-Control': 'no-store'
  // 'Retry-After': '5'
  fastify.post('/auth/login', async (request, reply) => {
    const timing = requestTiming();
    try {
      const body = request.body;
      if (body === undefined) return reply.code(400).send({ error: 'Invalid JSON' });
      if (typeof body?.email !== 'string' || body.email.length > 254 || typeof body.password !== 'string' || body.password.length > 1024) {
        return reply
          .status(400)
          .send({ error: 'Invalid login payload' });
      }
      const rateStart = performance.now();
      const rate = await checkRateLimit(body.email.trim().toLowerCase(), 'login');
      timing.record('rate_limit', performance.now() - rateStart);
      if (rate.unavailable) {
        reply.headers({ 'Retry-After': '5', 'Cache-Control': 'no-store', 'Server-Timing': timing.header() });
        return reply.status(503).send({ error: 'Sign-in is temporarily unavailable. Please try again shortly.' });
      }
      if (!rate.allowed) {
        reply.headers({ 'Retry-After': String(rate.retryAfter || 60), 'Cache-Control': 'no-store', 'Server-Timing': timing.header() });
        return reply.status(429).send({ error: 'Too many login attempts. Please wait before trying again.' });
      }
      const result = await AuthService.login(body, { onTiming: timing.record });
      reply.headers({ 'Cache-Control': 'no-store', 'Server-Timing': timing.header() });
      return reply.send(result);
    } catch (error) {
      if (error.status) {
        reply.headers({ 'Cache-Control': 'no-store', 'Server-Timing': timing.header(), ...(error.status === 503 ? { 'Retry-After': '5' } : {}) });
        return reply.status(error.status).send({ error: error.message });
      }
      console.error('Unhandled Login error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /auth/change-password — authenticated
  // status: 200, 400, 401, 500
  fastify.post('/auth/change-password', { onRequest: requireActor }, async (request, reply) => {
    try {
      const user = request.actor;
      const body = request.body;
      if (body === undefined) return reply.code(400).send({ error: 'Invalid JSON payload' });
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return reply.status(400).send({ error: 'Expected a JSON object' });
      }
      const result = await AuthService.changePassword(user, body);
      return reply.send(result);
    } catch (error) {
      if (error.status) {
        return reply.status(error.status).send({ error: error.message });
      }
      console.error('Change password error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /auth/profile — authenticated
  // status: 200, 401, 500
  fastify.get('/auth/profile', { onRequest: requireActor }, async (request, reply) => {
    try {
      const user = request.actor;
      const profile = await AuthService.getProfile(user);
      return reply.send({ user: profile });
    } catch (error) {
      if (error.status) {
        return reply.status(error.status).send({ error: error.message });
      }
      console.error('GET /api/auth/profile error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // PUT /auth/profile — authenticated
  // status: 200, 400, 401, 500
  fastify.put('/auth/profile', { onRequest: requireActor }, async (request, reply) => {
    try {
      const user = request.actor;
      const body = request.body;
      if (body === undefined) return reply.code(400).send({ error: 'Invalid JSON payload' });
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return reply.status(400).send({ error: 'Expected a JSON object' });
      }
      const result = await AuthService.updateProfile(user, body);
      return reply.send(result);
    } catch (error) {
      if (error.status) {
        return reply.status(error.status).send({ error: error.message });
      }
      console.error('PUT /api/auth/profile error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
  // Preserve Next's implicit method handling without parsing unsupported bodies.
  for (const [url, allowed] of [
    ['/auth/login', ['POST']],
    ['/auth/change-password', ['POST']],
    ['/auth/profile', ['GET', 'HEAD', 'PUT']],
  ]) {
    fastify.route({ method: 'OPTIONS', url,
      onRequest: async (request, reply) => reply.header('Allow', [...allowed, 'OPTIONS'].sort().join(', ')).code(204).send(),
      handler: async () => {},
    });
    fastify.route({ method: ['DELETE', 'GET', 'HEAD', 'PATCH', 'POST', 'PUT'].filter(method => !allowed.includes(method)), url,
      onRequest: async (request, reply) => reply.code(405).send(),
      handler: async () => {},
    });
  }

}

