export default async function operationsRoutes(fastify) {
  // status: 200
  fastify.get('/live', async (request, reply) => {
    reply.headers({ 'Cache-Control': 'no-store' });
    return reply.status(200).send({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  // Explicitly handle unsupported methods for /live with 405 Method Not Allowed
  fastify.route({
    method: ['POST', 'PUT', 'DELETE', 'PATCH'],
    url: '/live',
    handler: async (request, reply) => {
      reply.headers({ 'Cache-Control': 'no-store', 'Allow': 'GET, HEAD' });
      return reply.status(405).send({
        statusCode: 405,
        error: 'Method Not Allowed',
        message: `Method ${request.method} not allowed`,
      });
    },
  });
}
