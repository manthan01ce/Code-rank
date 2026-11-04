import { CoursesService } from './courses.service.js';
import { requireActor } from '../../middleware/authentication.js';

export default async function coursesRoutes(fastify) {
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

  // GET /courses — authenticated
  // status: 200
  fastify.get('/courses', { onRequest: requireActor }, async (request, reply) => {
    try {
      const user = request.actor;
      const { search, semester, cursor, limit = 100 } = request.query || {};
      const courses = await CoursesService.listCourses(user, { search, semester, cursor, limit });
      const limitNum = Number(limit) || 100;
      const nextCursor = courses.length === limitNum ? String(courses.at(-1).id) : '';
      reply.header('X-Next-Cursor', nextCursor);
      return reply.send(courses);
    } catch (error) {
      if (error.status) return reply.status(error.status).send({ error: error.message });
      console.error('GET /api/courses error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /courses — admin only
  // status: 200
  fastify.post('/courses', { onRequest: requireActor }, async (request, reply) => {
    try {
      const user = request.actor;
      const body = request.body;
      if (body === undefined) return reply.code(400).send({ error: 'Invalid JSON payload' });
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return reply.status(400).send({ error: 'Expected a JSON object' });
      }
      const course = await CoursesService.createCourse(user, body);
      return reply.send(course);
    } catch (error) {
      if (error.status) return reply.status(error.status).send({ error: error.message });
      console.error('POST /api/courses error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // PUT /courses/:id — admin only
  // status: 200
  fastify.put('/courses/:id', { onRequest: requireActor }, async (request, reply) => {
    try {
      const user = request.actor;
      const { id } = request.params;
      const body = request.body;
      if (body === undefined) return reply.code(400).send({ error: 'Invalid JSON payload' });
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return reply.status(400).send({ error: 'Expected a JSON object' });
      }
      const course = await CoursesService.updateCourse(user, id, body);
      return reply.send({ success: true, course });
    } catch (error) {
      if (error.status) return reply.status(error.status).send({ error: error.message });
      console.error('PUT /api/courses/:id error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // DELETE /courses/:id — admin only
  // status: 200
  fastify.delete('/courses/:id', { onRequest: requireActor }, async (request, reply) => {
    try {
      const user = request.actor;
      const { id } = request.params;
      const result = await CoursesService.deleteCourse(user, id);
      return reply.send(result);
    } catch (error) {
      if (error.status) return reply.status(error.status).send({ error: error.message });
      console.error('DELETE /api/courses/:id error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /departments — admin only
  // status: 200
  fastify.get('/departments', { onRequest: requireActor }, async (request, reply) => {
    try {
      const user = request.actor;
      const { search, cursor, limit = 100 } = request.query || {};
      const departments = await CoursesService.listDepartments(user, { search, cursor, limit });
      const limitNum = Number(limit) || 100;
      const nextCursor = departments.length === limitNum ? String(departments.at(-1).id) : '';
      reply.header('X-Next-Cursor', nextCursor);
      return reply.send(departments);
    } catch (error) {
      if (error.status) return reply.status(error.status).send({ error: error.message });
      console.error('GET /api/departments error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /departments — admin only
  // status: 200
  fastify.post('/departments', { onRequest: requireActor }, async (request, reply) => {
    try {
      const user = request.actor;
      const body = request.body;
      if (body === undefined) return reply.code(400).send({ error: 'Invalid JSON payload' });
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return reply.status(400).send({ error: 'Expected a JSON object' });
      }
      const department = await CoursesService.createDepartment(user, body);
      return reply.send(department);
    } catch (error) {
      if (error.status) return reply.status(error.status).send({ error: error.message });
      console.error('POST /api/departments error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // PUT /departments/:id — admin only
  // status: 200
  fastify.put('/departments/:id', { onRequest: requireActor }, async (request, reply) => {
    try {
      const user = request.actor;
      const { id } = request.params;
      const body = request.body;
      if (body === undefined) return reply.code(400).send({ error: 'Invalid JSON payload' });
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return reply.status(400).send({ error: 'Expected a JSON object' });
      }
      const department = await CoursesService.updateDepartment(user, id, body);
      return reply.send({ success: true, department });
    } catch (error) {
      if (error.status) return reply.status(error.status).send({ error: error.message });
      console.error('PUT /api/departments/:id error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // DELETE /departments/:id — admin only
  // status: 200
  fastify.delete('/departments/:id', { onRequest: requireActor }, async (request, reply) => {
    try {
      const user = request.actor;
      const { id } = request.params;
      const result = await CoursesService.deleteDepartment(user, id);
      return reply.send(result);
    } catch (error) {
      if (error.status) return reply.status(error.status).send({ error: error.message });
      console.error('DELETE /api/departments/:id error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  for (const [url, allowed] of [
    ['/courses', ['GET', 'HEAD', 'POST']],
    ['/courses/:id', ['DELETE', 'PUT']],
    ['/departments', ['GET', 'HEAD', 'POST']],
    ['/departments/:id', ['DELETE', 'PUT']],
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
