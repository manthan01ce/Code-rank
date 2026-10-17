import 'dotenv/config';
import { createServer } from 'http';
import { parse } from 'url';
import { fileURLToPath } from 'url';
import path from 'path';
import next from 'next';
import { Server } from 'socket.io';
import compression from 'compression';
import { performance } from 'perf_hooks';
import { verifyToken } from '@coderank/core/utils/auth';
import { logger } from '@coderank/core/utils/logger';
import { recordHttpRequest } from './src/lib/observability.js';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);
const appDirectory = path.dirname(fileURLToPath(import.meta.url));

// ─── Service token for the worker → server internal channel ──────────────────
const SERVICE_TOKEN = process.env.WORKER_SERVICE_TOKEN || (dev ? 'coderank-local-dev-service-token-32-chars-long-secure' : null);
if (!SERVICE_TOKEN || SERVICE_TOKEN.length < 32) {
  throw new Error(
    'FATAL: WORKER_SERVICE_TOKEN must be set and at least 32 characters long. ' +
    'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  );
}

const app = next({
  dev,
  hostname,
  port,
  dir: appDirectory,
  ...(dev ? {} : { conf: { compress: true, poweredByHeader: false } })
});

const handle = app.getRequestHandler();

const compressionMiddleware = compression({
  threshold: 1024,
  level: 6,
  filter: (req, res) => {
    const contentType = res.getHeader('Content-Type');
    if (contentType && (
      contentType.includes('image/') ||
      contentType.includes('video/') ||
      contentType.includes('audio/')
    )) return false;
    return compression.filter(req, res);
  }
});

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const startedAt = performance.now();
    res.once('finish', () => {
      const durationMs = performance.now() - startedAt;
      recordHttpRequest({ url: req.url, statusCode: res.statusCode, durationMs });
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
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Keep-Alive', 'timeout=5');
        const parsedUrl = parse(req.url, true);
        Promise.resolve(handle(req, res, parsedUrl)).catch(onError);
      });
    } catch (err) {
      onError(err);
    }
  });

  server.keepAliveTimeout = 65000;
  server.headersTimeout  = 66000;

  const io = new Server(server, {
    cors: {
      // In production, restrict to the app's own origin.
      origin: process.env.APP_ORIGIN || (dev ? '*' : false),
      methods: ['GET', 'POST'],
    },
    pingTimeout:      60000,
    pingInterval:     25000,
    upgradeTimeout:   10000,
    maxHttpBufferSize: 1e6,
    transports: ['websocket', 'polling'],
  });

  const connectedClients = {
    students: new Map(),
    faculty:  new Map(),
    admin:    new Map(),
  };

  global.io = io;

  // ─── Authentication middleware ─────────────────────────────────────────────
  // Every socket must supply a valid JWT OR the shared service token.
  // Connections without credentials are disconnected before any event handler runs.
  io.use((socket, next) => {
    const token       = socket.handshake?.auth?.token;
    const svcToken    = socket.handshake?.auth?.serviceToken;

    // Service channel (worker → server)
    if (svcToken) {
      if (svcToken === SERVICE_TOKEN) {
        socket._isService = true;
        return next();
      }
      return next(new Error('Invalid service token'));
    }

    // Browser channel — require a valid JWT
    if (!token) {
      return next(new Error('Authentication required'));
    }
    const decoded = verifyToken(token);
    if (!decoded) {
      return next(new Error('Invalid or expired token'));
    }
    socket._user = decoded;
    return next();
  });

  io.on('connection', (socket) => {
    // ── Service channel (worker) ─────────────────────────────────────────────
    if (socket._isService) {
      if (!dev) logger.info('Service socket connected', { socketId: socket.id });

      // Worker notifies server that a job is complete; server relays to client.
      // Only the service socket may emit this.
      socket.on('worker_job_complete', (data) => {
        if (!dev) logger.info('Job completed (service)', { jobId: data?.jobId });
        if (data?.jobId) {
          io.to(`job_${data.jobId}`).emit('job_complete', data.result);
        }
      });

      socket.on('disconnect', () => {
        if (!dev) logger.info('Service socket disconnected', { socketId: socket.id });
      });
      return; // No further handlers for service sockets
    }

    // ── Browser client channel ───────────────────────────────────────────────
    const userRole = socket._user.role || 'unknown';
    const userId   = socket._user.id;

    if (!dev) {
      logger.info('Socket authenticated', { socketId: socket.id, userId, userRole });
    }

    if (userRole === 'student' && userId) {
      connectedClients.students.set(socket.id, { userId, connectedAt: new Date() });
    } else if (userRole === 'faculty' && userId) {
      connectedClients.faculty.set(socket.id,  { userId, connectedAt: new Date() });
    } else if (userRole === 'admin' && userId) {
      connectedClients.admin.set(socket.id,    { userId, connectedAt: new Date() });
    }

    // ── Room joins ────────────────────────────────────────────────────────────
    // Students may only join the job rooms for their own jobs (verified at poll-time).
    // Faculty may join practical and course rooms for their own courses.
    socket.on('join_practical_room', (practicalId) => {
      // Only faculty and admin may watch all submissions in a practical room.
      if (userRole !== 'faculty' && userRole !== 'admin') {
        socket.emit('error', { message: 'Not authorized to join practical room' });
        return;
      }
      socket.join(`practical_${practicalId}`);
    });

    socket.on('leave_practical_room', (practicalId) => {
      socket.leave(`practical_${practicalId}`);
    });

    socket.on('join_course_room', (courseId) => {
      if (userRole !== 'faculty' && userRole !== 'admin' && userRole !== 'student') {
        socket.emit('error', { message: 'Not authorized' });
        return;
      }
      socket.join(`course_${courseId}`);
    });

    socket.on('leave_course_room', (courseId) => {
      socket.leave(`course_${courseId}`);
    });

    // ── Job watch rooms ───────────────────────────────────────────────────────
    // Any authenticated user may watch their own job; the result is already
    // ownership-checked before being emitted by worker_job_complete above.
    socket.on('watch_job', (jobId) => {
      socket.join(`job_${jobId}`);
    });

    socket.on('unwatch_job', (jobId) => {
      socket.leave(`job_${jobId}`);
    });

    // ── Faculty broadcast events ──────────────────────────────────────────────
    // Accepted only from faculty or admin — never from a student or anonymous client.
    socket.on('faculty_practical_added', (data) => {
      if (userRole !== 'faculty' && userRole !== 'admin') {
        socket.emit('error', { message: 'Not authorized to broadcast faculty events' });
        return;
      }
      const practical = data?.practical || data;
      const courseId  = data?.course_id || practical?.course_id;
      if (courseId) io.to(`course_${courseId}`).emit('practical_added', practical);
    });

    socket.on('faculty_practical_updated', (data) => {
      if (userRole !== 'faculty' && userRole !== 'admin') {
        socket.emit('error', { message: 'Not authorized' });
        return;
      }
      const practical = data?.practical || data;
      const courseId  = data?.course_id || practical?.course_id;
      if (courseId) io.to(`course_${courseId}`).emit('practical_updated', practical);
    });

    socket.on('faculty_practical_deleted', (data) => {
      if (userRole !== 'faculty' && userRole !== 'admin') {
        socket.emit('error', { message: 'Not authorized' });
        return;
      }
      const practicalId = data?.practicalId || data?.id || data;
      const courseId    = data?.course_id;
      if (courseId) io.to(`course_${courseId}`).emit('practical_deleted', practicalId);
    });

    // ── Student submission events ─────────────────────────────────────────────
    // Only student role may trigger new_submission broadcasts.
    socket.on('student_new_submission', (data) => {
      if (userRole !== 'student') {
        socket.emit('error', { message: 'Not authorized' });
        return;
      }
      const submission  = data?.submission || data;
      const practicalId = data?.practical_id || submission?.practical_id;
      const courseId    = data?.course_id    || submission?.course_id;

      if (practicalId) {
        io.to(`practical_${practicalId}`).emit('new_submission', submission);
      }
      if (courseId) {
        io.to(`course_${courseId}`).emit('new_submission_marks', {
          course_id: courseId,
          practical_id: practicalId
        });
      }
      // Do NOT emit globally — faculty only see rooms they are subscribed to.
    });

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      ['students', 'faculty', 'admin'].forEach(role => {
        if (connectedClients[role].has(socket.id)) {
          connectedClients[role].delete(socket.id);
        }
      });
    });
  });

  server
    .once('error', (err) => {
      logger.error('Server error', err);
      process.exit(1);
    })
    .listen(port, hostname, () => {
      logger.info('CodeRank Server ready', {
        local:   `http://localhost:${port}`,
        network: `http://${hostname === '0.0.0.0' ? '0.0.0.0' : hostname}:${port}`,
        mode:    dev ? 'development' : 'production',
        pid:     process.pid
      });
    });
});
