import '../../packages/core/src/config/env.js';
import { createServer } from 'http';
import { parse } from 'url';
import { fileURLToPath } from 'url';
import path from 'path';
import next from 'next';
import { Server } from 'socket.io';
import compression from 'compression';
import { performance } from 'perf_hooks';
import { configureRealtimeAdapter } from './src/lib/realtime-adapter.js';
import { attachRealtime, revalidateRealtimeRooms } from './src/lib/realtime.js';
import { guardRealtimeSession } from './src/lib/realtime-session.js';
import { guestActor } from '@coderank/core/security/execution';
import { verifyServiceToken } from '@coderank/core/security/service-token';
import { PracticalService } from '@coderank/core/services/PracticalService';
import { SubmissionService } from '@coderank/core/services/SubmissionService';
import sql from '@coderank/core/db';
import { authenticateToken } from '@coderank/core/security/active-actor';
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

// Compression middleware configuration
const compressionMiddleware = compression({
  threshold: 1024, // Only compress responses > 1KB
  level: 6, // Balanced compression level (0-9)
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

  const io = new Server(server, {
    cors: {
      origin: (process.env.ALLOWED_ORIGIN || 'http://localhost:3000').split(',').map(value => value.trim()),
      methods: ['GET', 'POST']
    },
    // Performance optimizations for Socket.IO
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 10000,
    maxHttpBufferSize: 1e6, // 1MB
    transports: ['websocket'], // One connection stays on one process; no polling affinity required.
  });

  const closeAdapter = await configureRealtimeAdapter(io);
  const shutdown = async () => {
    io.close();
    server.close();
    await closeAdapter();
    await app.close();
    process.exit(0);
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  global.io = io;
  io.use(async (socket, next) => {
    try {
      const serviceToken = socket.handshake.auth?.serviceToken;
      const token = socket.handshake.auth?.token;
      const service = serviceToken !== undefined ? verifyServiceToken(serviceToken) : null;
      if (serviceToken !== undefined && !service) throw new Error('Invalid service credentials');
      const actor = token !== undefined ? await authenticateToken(token)
        : service ? null : guestActor(socket.handshake.headers.cookie || '');
      if (!service && !actor) throw new Error('Authentication required');
      socket.data.service = !!service;
      socket.data.actor = actor;
      socket.data.token = token;
      socket.data.serviceToken = serviceToken;
      socket.data.expiresAt = service ? service.exp * 1000
        : actor.role === 'guest' ? Date.now() + 86400000 : actor.exp * 1000;
      next();
    } catch { next(new Error('Authentication required')); }
  });
  io.on('connection', socket => {
    const authorization = {
    refreshActor: () => socket.data.actor?.role === 'guest' ? socket.data.actor : authenticateToken(socket.data.token),
    validateService: () => !!verifyServiceToken(socket.data.serviceToken),
    authorizePractical: (actor, id) => PracticalService.authorize(actor, id),
    getJobStatus: (id, actor) => SubmissionService.getJobStatus(id, actor),
    authorizeCourse: async (actor, id) => {
      if (!actor || actor.role === 'guest') throw new Error('Authentication required');
      if (actor.role === 'admin') return;
      const rows = actor.role === 'faculty'
        ? await sql`SELECT 1 FROM course_faculty WHERE course_id = ${id} AND faculty_id = ${actor.id}`
        : await sql`SELECT 1 FROM users u JOIN courses c ON c.semester = (u.extra_info->>'semester')::int WHERE u.id = ${actor.id} AND u.status = 'active' AND c.id = ${id} AND (u.session_token IS NULL OR u.session_token = ${actor.session_token || ''})`;
      if (!rows.length) throw new Error('Course access denied');
    },
    };
    attachRealtime(io, socket, authorization);
    guardRealtimeSession(socket, {
      expiresAt: socket.data.expiresAt,
      revalidate: !socket.data.service ? async () => {
        if (socket.data.actor?.role !== 'guest') socket.data.actor = await authenticateToken(socket.data.token);
        await revalidateRealtimeRooms(socket, { ...authorization, actor: socket.data.actor });
      } : undefined,
    });
  });

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
