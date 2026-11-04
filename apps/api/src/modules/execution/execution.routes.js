import { ExecutionService } from './execution.service.js';
import { ALLOWED_LANGUAGES, GUEST_COOKIE } from '@coderank/core/security/execution';

export default async function executionRoutes(fastify) {
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

  fastify.setErrorHandler((error, request, reply) => {
    const status = error.statusCode || error.status || 500;
    const invalidJson = error.code === 'INVALID_JSON' || error.code === 'FST_ERR_CTP_EMPTY_JSON_BODY';
    reply.header('Cache-Control', 'no-store');
    if (status === 503) reply.header('Retry-After', '5');
    reply.code(status).send({
      success: false,
      error: invalidJson
        ? 'Invalid JSON payload'
        : status === 413
          ? 'Request body is too large'
          : status < 500
            ? error.message
            : 'Internal server error',
    });
  });

  // Language execution aliases
  const languageAliases = [
    ['/c-run', 'c'],
    ['/cpp-run', 'cpp'],
    ['/java-run', 'java'],
    ['/javascript-run', 'javascript'],
    ['/python-run', 'python'],
  ];

  for (const [url, lang] of languageAliases) {
    fastify.post(url, async (request, reply) => {
      try {
        if (!request.body || typeof request.body !== 'object') {
          return sendExecutionError(reply, { status: 400, message: 'Invalid payload' });
        }
        const result = await ExecutionService.handlePracticeExecution({
          request,
          body: request.body,
          fixedLanguage: lang,
        });
        return sendExecutionResponse(reply, request, result);
      } catch (error) {
        return sendExecutionError(reply, error);
      }
    });
  }

  // POST /run — Generic execution endpoint
  fastify.post('/run', async (request, reply) => {
    try {
      if (!request.body || typeof request.body !== 'object') {
        return sendExecutionError(reply, { status: 400, message: 'Invalid payload' });
      }
      const result = await ExecutionService.handlePracticeExecution({
        request,
        body: request.body,
      });
      return sendExecutionResponse(reply, request, result);
    } catch (error) {
      return sendExecutionError(reply, error);
    }
  });

  // /practice-run — GET (queue stats) and POST (playground execution)
  fastify.get('/practice-run', async (request, reply) => {
    try {
      const queue = await ExecutionService.getQueueStats();
      return reply
        .header('Cache-Control', 'no-store')
        .code(queue.cached ? 503 : 200)
        .send({
          status: queue.cached ? 'degraded' : 'healthy',
          queue,
          message: 'Execution queue connectivity; runner capacity is monitored separately',
        });
    } catch {
      return reply
        .header('Cache-Control', 'no-store')
        .code(503)
        .send({ status: 'error', message: 'Execution queue unavailable' });
    }
  });

  fastify.post('/practice-run', async (request, reply) => {
    try {
      if (!request.body || typeof request.body !== 'object') {
        return sendExecutionError(reply, { status: 400, message: 'Invalid payload' });
      }
      const result = await ExecutionService.enqueueExecution({
        request,
        type: 'playground',
        payload: {
          language: 'python',
          code: request.body?.code,
          input: request.body?.input ?? request.body?.stdin ?? '',
        },
      });
      return sendExecutionResponse(reply, request, result);
    } catch (error) {
      return sendExecutionError(reply, error);
    }
  });

  // /execute — GET (queue stats & languages) and POST (playground execution)
  fastify.get('/execute', async (request, reply) => {
    try {
      const stats = await ExecutionService.getQueueStats();
      return reply
        .header('Cache-Control', 'no-store')
        .code(stats.cached ? 503 : 200)
        .send({
          status: stats.cached ? 'degraded' : 'healthy',
          queue: stats,
          languages: Array.from(ALLOWED_LANGUAGES),
          message: 'Execution queue connectivity; runner capacity is monitored separately',
        });
    } catch {
      return reply
        .header('Cache-Control', 'no-store')
        .code(503)
        .send({ status: 'error', message: 'Execution queue unavailable' });
    }
  });

  fastify.post('/execute', async (request, reply) => {
    try {
      if (!request.body || typeof request.body !== 'object') {
        return sendExecutionError(reply, { status: 400, message: 'Invalid payload' });
      }
      const result = await ExecutionService.enqueueExecution({
        request,
        type: 'playground',
        payload: {
          language: request.body?.language,
          code: request.body?.code,
          input: request.body?.input ?? '',
        },
      });
      return sendExecutionResponse(reply, request, result);
    } catch (error) {
      return sendExecutionError(reply, error);
    }
  });

  // GET /jobs/:jobId — Polling job status
  fastify.get('/jobs/:jobId', async (request, reply) => {
    try {
      const { jobId } = request.params;
      if (!jobId) {
        return reply.header('Cache-Control', 'no-store').code(400).send({ error: 'jobId is required' });
      }

      const actor = await ExecutionService.getExecutionActor(request);
      const job = await ExecutionService.getJobStatus(jobId, actor);
      if (!job) {
        return reply.header('Cache-Control', 'no-store').code(404).send({ error: 'Job not found' });
      }

      return reply.header('Cache-Control', 'no-store').code(200).send(job);
    } catch (error) {
      return sendExecutionError(reply, error);
    }
  });

  // Method Not Allowed (405) handling preserving exact contracts
  const routeMethods = [
    ['/c-run', ['POST']],
    ['/cpp-run', ['POST']],
    ['/java-run', ['POST']],
    ['/javascript-run', ['POST']],
    ['/python-run', ['POST']],
    ['/run', ['POST']],
    ['/practice-run', ['GET', 'HEAD', 'POST']],
    ['/execute', ['GET', 'HEAD', 'POST']],
    ['/jobs/:jobId', ['GET', 'HEAD']],
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
