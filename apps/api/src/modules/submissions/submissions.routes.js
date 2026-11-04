import { SubmissionsService } from './submissions.service.js';
import { GUEST_COOKIE } from '@coderank/core/security/execution';
import { requireActor } from '../../middleware/authentication.js';

export default async function submissionsRoutes(fastify) {
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

  function sendExecutionResponse(reply, request, result) {
    reply.header('Cache-Control', 'no-store');
    if (result.actor?.role === 'guest' && result.actor.cookie) {
      const isHttps = request.protocol === 'https' || request.headers['x-forwarded-proto'] === 'https';
      reply.header(
        'Set-Cookie',
        `${GUEST_COOKIE}=${result.actor.cookie}; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax${isHttps ? '; Secure' : ''}`
      );
    }
    return reply.code(202).send({ success: true, jobId: result.jobId, status: result.status || 'queued' });
  }

  function sendExecutionError(reply, error) {
    const status = error.message === 'QUEUE_FULL' ? 503 : error.status || error.statusCode || 500;
    if (status === 500) console.error('Execution API failed:', error);
    reply.header('Cache-Control', 'no-store');
    if (status === 503) reply.header('Retry-After', '5');
    return reply.code(status).send({
      success: false,
      error: status === 500 ? 'Internal server error' : error.message,
    });
  }

  function sendRouteError(reply, error, defaultMessage = 'Internal server error') {
    const status = error.statusCode || error.status || 500;
    if (status === 500) console.error('API operation failed:', error);
    reply.header('Cache-Control', 'no-store');
    return reply.code(status).send({
      error: error.status ? error.message : defaultMessage,
    });
  }

  fastify.setErrorHandler((error, request, reply) => {
    const status = error.statusCode || error.status || 500;
    const invalidJson = error.code === 'INVALID_JSON' || error.code === 'FST_ERR_CTP_EMPTY_JSON_BODY';
    reply.header('Cache-Control', 'no-store');
    if (status === 503) reply.header('Retry-After', '5');
    const message = invalidJson
      ? 'Invalid JSON payload'
      : status === 413
        ? 'Request body is too large'
        : status < 500
          ? error.message
          : 'Internal server error';

    if (request.url.includes('/submit')) {
      return reply.code(status).send({ success: false, error: message });
    }
    return reply.code(status).send({ error: message });
  });

  // POST /submit — Generic practice submission
  fastify.post('/submit', async (request, reply) => {
    try {
      const result = await SubmissionsService.submitPractice({ request, body: request.body });
      return sendExecutionResponse(reply, request, result);
    } catch (error) {
      return sendExecutionError(reply, error);
    }
  });

  // POST /student/practicals/:id/submit — Student graded practical submission
  fastify.post('/student/practicals/:id/submit', async (request, reply) => {
    try {
      const result = await SubmissionsService.submitPractical({
        request,
        id: request.params.id,
        body: request.body,
      });
      return sendExecutionResponse(reply, request, result);
    } catch (error) {
      return sendExecutionError(reply, error);
    }
  });

  // GET /student/submissions — Student global submission history
  fastify.get('/student/submissions', { onRequest: requireActor }, async (request, reply) => {
    try {
      const searchParams = new URL(request.url, 'http://localhost').searchParams;
      const { rows, nextCursor } = await SubmissionsService.getStudentSubmissions(request.actor, null, searchParams);
      reply.header('X-Next-Cursor', nextCursor);
      return reply.send(rows);
    } catch (error) {
      return sendRouteError(reply, error);
    }
  });

  // GET /student/practicals/:id/submissions — Student practical submission history
  fastify.get('/student/practicals/:id/submissions', { onRequest: requireActor }, async (request, reply) => {
    try {
      const searchParams = new URL(request.url, 'http://localhost').searchParams;
      const { rows, nextCursor } = await SubmissionsService.getStudentSubmissions(request.actor, request.params.id, searchParams);
      reply.header('X-Next-Cursor', nextCursor);
      return reply.send(rows);
    } catch (error) {
      return sendRouteError(reply, error);
    }
  });

  // GET /faculty/practicals/:id/submissions — Faculty practical submissions review
  fastify.get('/faculty/practicals/:id/submissions', { onRequest: requireActor }, async (request, reply) => {
    try {
      const searchParams = new URL(request.url, 'http://localhost').searchParams;
      const { rows, nextCursor } = await SubmissionsService.getFacultyPracticalSubmissions(request.actor, request.params.id, searchParams);
      reply.header('X-Next-Cursor', nextCursor);
      return reply.send(rows);
    } catch (error) {
      return sendRouteError(reply, error);
    }
  });

  // GET /faculty/submissions/:id — Faculty submission detail inspection
  fastify.get('/faculty/submissions/:id', { onRequest: requireActor }, async (request, reply) => {
    try {
      const submission = await SubmissionsService.getSubmission(request.actor, request.params.id);
      return reply.send(submission);
    } catch (error) {
      return sendRouteError(reply, error);
    }
  });

  // DELETE /faculty/submissions/:id — Faculty submission reset/deletion
  fastify.delete('/faculty/submissions/:id', { onRequest: requireActor }, async (request, reply) => {
    try {
      const result = await SubmissionsService.deleteSubmission(request.actor, request.params.id);
      return reply.send(result);
    } catch (error) {
      return sendRouteError(reply, error, 'Failed to delete submission');
    }
  });

  // GET /student/workspaces/load — Student draft workspace loading
  fastify.get('/student/workspaces/load', { onRequest: requireActor }, async (request, reply) => {
    try {
      const searchParams = new URL(request.url, 'http://localhost').searchParams;
      const practicalId = searchParams.get('practical_id') || searchParams.get('practicalId');
      const language = searchParams.get('language');
      const result = await SubmissionsService.loadWorkspace(request.actor, practicalId, language);
      return reply.send(result);
    } catch (error) {
      return sendRouteError(reply, error);
    }
  });

  // POST /student/workspaces/save — Student draft workspace saving
  fastify.post('/student/workspaces/save', { onRequest: requireActor }, async (request, reply) => {
    try {
      const result = await SubmissionsService.saveWorkspace(request.actor, request.body);
      return reply.send(result);
    } catch (error) {
      return sendRouteError(reply, error);
    }
  });

  // Method Not Allowed (405) handling preserving exact contracts
  const routeMethods = [
    ['/submit', ['POST']],
    ['/student/practicals/:id/submit', ['POST']],
    ['/student/submissions', ['GET', 'HEAD']],
    ['/student/practicals/:id/submissions', ['GET', 'HEAD']],
    ['/faculty/practicals/:id/submissions', ['GET', 'HEAD']],
    ['/faculty/submissions/:id', ['DELETE', 'GET', 'HEAD']],
    ['/student/workspaces/load', ['GET', 'HEAD']],
    ['/student/workspaces/save', ['POST']],
  ];

  for (const [url, allowed] of routeMethods) {
    const allowHeader = [...new Set([...allowed, 'OPTIONS'])].sort().join(', ');
    fastify.route({
      method: 'OPTIONS',
      url,
      onRequest: async (request, reply) => reply.header('Allow', allowHeader).code(204).send(),
      handler: async () => {},
    });
    fastify.route({
      method: ['DELETE', 'GET', 'HEAD', 'PATCH', 'POST', 'PUT'].filter(method => !allowed.includes(method)),
      url,
      onRequest: async (request, reply) => reply.header('Allow', allowHeader).code(405).send({
        statusCode: 405,
        error: 'Method Not Allowed',
        message: `Method ${request.method} not allowed`,
      }),
      handler: async () => {},
    });
  }
}
