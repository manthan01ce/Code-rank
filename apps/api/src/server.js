import './config/env.js';
import { host, port } from './config/env.js';
import { buildApp } from './app.js';

const app = buildApp({
  logger: process.env.NODE_ENV !== 'production'
    ? { level: 'info' }
    : { level: 'warn' },
});

let isShuttingDown = false;

export async function start() {
  try {
    const address = await app.listen({ host, port });
    console.log(`API server listening on ${address}`);
    return address;
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

export async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`Received ${signal}, gracefully shutting down API server...`);
  try {
    await app.close();
    console.log('API server closed');
  } catch (err) {
    console.error('Error during API server shutdown:', err);
    process.exit(1);
  }
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

await start();

export { app };
