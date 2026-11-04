import { authenticateRequest } from '@coderank/core/security/active-actor';

// Authenticate before body parsing, as the former Next protected adapters did.
export async function requireActor(request, reply) {
  try { request.actor = await authenticateRequest(request); }
  catch (error) {
    const status = error.status || 500;
    reply.header('Cache-Control', 'no-store').code(status).send({
      error: error.status ? error.message : 'Internal server error',
    });
  }
}
