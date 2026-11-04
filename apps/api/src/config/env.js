import '@coderank/core/config/env';

// PORT belongs to web during this mixed-runtime stage; API has its own port.
export function resolveApiEnvironment(env = process.env) {
  const value = env.API_PORT || '3001';
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) {
    throw new Error('API_PORT must be an integer between 1 and 65535');
  }
  return { port: Number(value), host: env.API_HOST || '127.0.0.1' };
}
export const { port, host } = resolveApiEnvironment();
