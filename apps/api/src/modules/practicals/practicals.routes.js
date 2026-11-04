import { PracticalsService } from './practicals.service.js';
import { requireActor } from '../../middleware/authentication.js';

export default async function practicalsRoutes(fastify) {
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

  function validateJsonObject(body) {
    if (body === undefined) throw { status: 400, message: 'Invalid JSON payload' };
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw { status: 400, message: 'Expected a JSON object' };
    }
    return body;
  }

  // GET /faculty/batches
  fastify.get('/faculty/batches', { onRequest: requireActor }, async (request, reply) => {
    try {
      const user = request.actor;
      const limit = request.query?.limit || 100;
      const batches = await PracticalsService.getBatches(user, {
        cursor: request.query?.cursor,
        limit,
      });
      const limitNum = Number(limit) || 100;
      reply.header('X-Next-Cursor', batches.length === limitNum ? batches.at(-1) : '');
      return reply.send(batches);
    } catch (error) {
      if (error.status) return reply.status(error.status).send({ error: error.message });
      console.error('Fetch batches error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /faculty/courses
  fastify.get('/faculty/courses', { onRequest: requireActor }, async (request, reply) => {
    try {
      const user = request.actor;
      const limit = request.query?.limit || 100;
      const courses = await PracticalsService.getFacultyCourses(user, {
        cursor: request.query?.cursor,
        limit,
      });
      const limitNum = Number(limit) || 100;
      reply.header('X-Next-Cursor', courses.length === limitNum ? String(courses.at(-1).id) : '');
      return reply.send(courses);
    } catch (error) {
      if (error.status) return reply.status(error.status).send({ error: error.message });
      console.error('Fetch faculty courses error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /faculty/courses/:id/stats
  fastify.get('/faculty/courses/:id/stats', { onRequest: requireActor }, async (request, reply) => {
    try {
      const user = request.actor;
      const report = await PracticalsService.getCourseStats(user, request.params.id, request.query);
      return reply.send(report);
    } catch (error) {
      if (error.status) return reply.status(error.status).send({ error: error.message });
      console.error('API operation failed:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /faculty/practicals
  fastify.get('/faculty/practicals', { onRequest: requireActor }, async (request, reply) => {
    try {
      const user = request.actor;
      const limit = request.query?.limit || 100;
      const practicals = await PracticalsService.listFacultyPracticals(user, request.query?.course_id, {
        cursor: request.query?.cursor,
        limit,
      });
      const limitNum = Number(limit) || 100;
      reply.header('X-Next-Cursor', practicals.length === limitNum ? String(practicals.at(-1).id) : '');
      return reply.send(practicals);
    } catch (error) {
      if (error.status) return reply.status(error.status).send({ error: error.message });
      console.error('API operation failed:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /faculty/practicals
  fastify.post('/faculty/practicals', { onRequest: requireActor }, async (request, reply) => {
    try {
      const user = request.actor;
      const body = validateJsonObject(request.body);
      const practical = await PracticalsService.createPractical(user, body);
      try {
        fastify.publisher?.publishPracticalChange('added', {
          courseId: practical.course_id,
          practical,
          practicalId: practical.id,
        });
      } catch (pubErr) {
        console.warn('Practical notification failed:', pubErr.message);
      }
      return reply.send({ success: true, practical });
    } catch (error) {
      if (error.status) return reply.status(error.status).send({ error: error.message });
      console.error('API operation failed:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /faculty/practicals/:id
  fastify.get('/faculty/practicals/:id', { onRequest: requireActor }, async (request, reply) => {
    try {
      const user = request.actor;
      const practical = await PracticalsService.getFacultyPractical(user, request.params.id);
      return reply.send(practical);
    } catch (error) {
      if (error.status) return reply.status(error.status).send({ error: error.message });
      console.error('API operation failed:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // PUT /faculty/practicals/:id
  fastify.put('/faculty/practicals/:id', { onRequest: requireActor }, async (request, reply) => {
    try {
      const user = request.actor;
      const body = validateJsonObject(request.body);
      const practical = await PracticalsService.updatePractical(user, request.params.id, body);
      try {
        fastify.publisher?.publishPracticalChange('updated', {
          courseId: practical.course_id,
          practical,
          practicalId: practical.id,
        });
      } catch (pubErr) {
        console.warn('Practical notification failed:', pubErr.message);
      }
      return reply.send({ success: true, practical });
    } catch (error) {
      if (error.status) return reply.status(error.status).send({ error: error.message });
      console.error('API operation failed:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // DELETE /faculty/practicals/:id
  fastify.delete('/faculty/practicals/:id', { onRequest: requireActor }, async (request, reply) => {
    try {
      const user = request.actor;
      const practical = await PracticalsService.deletePractical(user, request.params.id);
      try {
        fastify.publisher?.publishPracticalChange('deleted', {
          courseId: practical.course_id,
          practical,
          practicalId: practical.id,
        });
      } catch (pubErr) {
        console.warn('Practical notification failed:', pubErr.message);
      }
      return reply.send({ success: true, message: 'Practical archived. Existing grading history is preserved.' });
    } catch (error) {
      if (error.status) return reply.status(error.status).send({ error: error.message });
      console.error('API operation failed:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /faculty/practicals/:id/extra-time
  fastify.post('/faculty/practicals/:id/extra-time', { onRequest: requireActor }, async (request, reply) => {
    try {
      const user = request.actor;
      const body = validateJsonObject(request.body);
      const practical = await PracticalsService.extendPractical(user, request.params.id, body);
      try {
        fastify.publisher?.publishPracticalChange('updated', {
          courseId: practical.course_id,
          practical,
          practicalId: practical.id,
        });
      } catch (pubErr) {
        console.warn('Practical notification failed:', pubErr.message);
      }
      return reply.send({
        success: true,
        message: `Extra time granted successfully. New deadline: ${new Date(practical.end_time).toLocaleString()}`,
        practical,
      });
    } catch (error) {
      if (error.status) return reply.status(error.status).send({ error: error.message });
      console.error('API operation failed:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /faculty/practicals/:id/stats
  fastify.get('/faculty/practicals/:id/stats', { onRequest: requireActor }, async (request, reply) => {
    try {
      const user = request.actor;
      const report = await PracticalsService.getPracticalStats(user, request.params.id, {
        cursor: request.query?.cursor,
        limit: request.query?.limit || 50,
      });
      return reply.send(report);
    } catch (error) {
      if (error.status) return reply.status(error.status).send({ error: error.message });
      console.error('API operation failed:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /student/practicals
  fastify.get('/student/practicals', { onRequest: requireActor }, async (request, reply) => {
    try {
      const user = request.actor;
      const limit = request.query?.limit || 25;
      const practicals = await PracticalsService.listStudentPracticals(user, request.query?.course_id, {
        cursor: request.query?.cursor,
        limit,
      });
      const limitNum = Number(limit) || 25;
      reply.header('X-Next-Cursor', practicals.length === limitNum ? String(practicals.at(-1).id) : '');
      return reply.send(practicals);
    } catch (error) {
      if (error.status) return reply.status(error.status).send({ error: error.message });
      console.error('API operation failed:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /student/practicals/:id
  fastify.get('/student/practicals/:id', { onRequest: requireActor }, async (request, reply) => {
    try {
      const user = request.actor;
      const detail = await PracticalsService.getStudentPractical(user, request.params.id);
      return reply.send(detail);
    } catch (error) {
      if (error.status) return reply.status(error.status).send({ error: error.message });
      console.error('API operation failed:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  const routeDefinitions = [
    ['/faculty/batches', ['GET', 'HEAD']],
    ['/faculty/courses', ['GET', 'HEAD']],
    ['/faculty/courses/:id/stats', ['GET', 'HEAD']],
    ['/faculty/practicals', ['GET', 'HEAD', 'POST']],
    ['/faculty/practicals/:id', ['DELETE', 'GET', 'HEAD', 'PUT']],
    ['/faculty/practicals/:id/extra-time', ['POST']],
    ['/faculty/practicals/:id/stats', ['GET', 'HEAD']],
    ['/student/practicals', ['GET', 'HEAD']],
    ['/student/practicals/:id', ['GET', 'HEAD']],
  ];

  for (const [url, allowed] of routeDefinitions) {
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
