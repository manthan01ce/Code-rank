import { requestTiming } from '@coderank/core/utils/request-timing';
import { UserService } from '@coderank/core/services/UserService';
import { authenticateRequest } from '@coderank/core/security/active-actor';
import { checkRateLimit } from '../../middleware/rate-limiter.js';

export default async function authRoutes(fastify) {
  // POST /auth/login — public, rate-limited
  // status: 200, 400, 401, 429, 500, 503
  // 'Cache-Control': 'no-store'
  // 'Retry-After': '5'
  fastify.post('/auth/login', async (request, reply) => {
    const timing = requestTiming();
    try {
      const body = request.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return reply
          .status(400)
          .send({ error: 'Invalid JSON' });
      }

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
      const result = await UserService.login(body, { onTiming: timing.record });
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
  fastify.post('/auth/change-password', async (request, reply) => {
    try {
      const user = await authenticateRequest(request);
      const body = request.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return reply.status(400).send({ error: 'Expected a JSON object' });
      }
      const result = await UserService.changePassword(user, body);
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
  fastify.get('/auth/profile', async (request, reply) => {
    try {
      const user = await authenticateRequest(request);
      const profile = await UserService.getProfile(user);
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
  fastify.put('/auth/profile', async (request, reply) => {
    try {
      const user = await authenticateRequest(request);
      const body = request.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return reply.status(400).send({ error: 'Expected a JSON object' });
      }
      const result = await UserService.updateProfile(user, body);
      return reply.send(result);
    } catch (error) {
      if (error.status) {
        return reply.status(error.status).send({ error: error.message });
      }
      console.error('PUT /api/auth/profile error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}

