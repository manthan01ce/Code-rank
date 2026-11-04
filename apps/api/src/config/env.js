import '@coderank/core/config/env';

/**
 * Port resolution precedence:
 * 1. API_PORT: explicit port for the Fastify API runtime (prevents collision with web's PORT)
 * 2. PORT: fallback if API_PORT is not specified (e.g. in container environments)
 * 3. 3001: default host development port
 */
export const port = parseInt(process.env.API_PORT || process.env.PORT || '3001', 10);

/**
 * Host resolution precedence:
 * 1. API_HOST: explicit host binding
 * 2. HOSTNAME: environment host binding (e.g. 0.0.0.0 in Docker)
 * 3. 127.0.0.1: default loopback host development
 */
export const host = process.env.API_HOST || process.env.HOSTNAME || '127.0.0.1';

export const isProduction = process.env.NODE_ENV === 'production';
