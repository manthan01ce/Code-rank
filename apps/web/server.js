import '@coderank/core/config/env';
import { createServer } from 'http';
import { parse } from 'url';
import { fileURLToPath } from 'url';
import path from 'path';
import next from 'next';
import { createApiGateway } from './src/lib/api-gateway.js';
import compression from 'compression';
import { performance } from 'perf_hooks';
import { logger } from '@coderank/core/utils/logger';
import { recordHttpRequest } from './src/lib/observability.js';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);
const appDirectory = path.dirname(fileURLToPath(import.meta.url));

// Performance optimizations
const app = next({ 
  dev, 
  hostname, 
  port,
  dir: appDirectory,
  // Production optimizations
  ...(dev ? {} : {
    conf: {
      compress: true,
      poweredByHeader: false,
    }
  })
});

const handle = app.getRequestHandler();
const proxyApi = createApiGateway();

// Performance middleware
const compressionMiddleware = compression({
  threshold: 1024, // Only compress responses larger than 1KB
  level: 6, // Balanced compression level
  filter: (req, res) => {
    // Don't compress images and other already-compressed content
    const contentType = res.getHeader('Content-Type');
    if (contentType && (
      contentType.includes('image/') ||
      contentType.includes('video/') ||
      contentType.includes('audio/')
    )) {
      return false;
    }
    // Fall back to compression's default filter
    return compression.filter(req, res);
  }
});

app.prepare().then(async () => {
  const server = createServer((req, res) => {
    const startedAt = performance.now();
    res.once('finish', () => {
      const durationMs = performance.now() - startedAt;
      recordHttpRequest({ url: req.url, statusCode: res.statusCode, durationMs });
      // Keep production request logging off the hot path. Errors retain a
      // concise signal without generating a line for every successful request.
      if (res.statusCode >= 500) {
        logger.warn('HTTP request failed', {
          method: req.method,
          path: req.url?.split('?')[0],
          statusCode: res.statusCode,
          durationMs: Math.round(durationMs),
        });
      }
    });

    const onError = (err) => {
      logger.error('Error occurred handling request', err, { url: req.url });
      if (!res.headersSent) res.statusCode = 500;
      res.end('internal server error');
    };

    try {
      if (proxyApi(req, res)) return;
      compressionMiddleware(req, res, () => {
        // Enable keep-alive for better performance
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Keep-Alive', 'timeout=5');
        const parsedUrl = parse(req.url, true);
        Promise.resolve(handle(req, res, parsedUrl)).catch(onError);
      });
    } catch (err) {
      onError(err);
    }
  });

  // Optimize server settings
  server.keepAliveTimeout = 65000; // Slightly higher than load balancer timeout
  server.headersTimeout = 66000; // Slightly higher than keepAliveTimeout

  server.on('upgrade', (req, socket, head) => {
    if (proxyApi.upgrade?.(req, socket, head)) return;
    socket.destroy();
  });

  const shutdown = async () => {
    proxyApi.close?.();
    server.close();
    await app.close();
    process.exit(0);
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  server
    .once('error', (err) => {
      logger.error('Server error', err);
      process.exit(1);
    })
    .listen(port, hostname, () => {
      logger.info('CodeRank Server ready', {
        local: `http://localhost:${port}`,
        network: `http://${hostname === '0.0.0.0' ? '0.0.0.0' : hostname}:${port}`,
        mode: dev ? 'development' : 'production',
        pid: process.pid
      });
    });
}).catch(error => { logger.error('Web startup failed', error); process.exit(1); });
