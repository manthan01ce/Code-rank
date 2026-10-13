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

app.prepare().then(() => {
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
      origin: '*',
      methods: ['GET', 'POST']
    },
    // Performance optimizations for Socket.IO
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 10000,
    maxHttpBufferSize: 1e6, // 1MB
    transports: ['websocket', 'polling'], // Prefer websocket
  });

  // Track connected clients by role for debugging
  const connectedClients = {
    students: new Map(),
    faculty: new Map(),
    admin: new Map(),
  };

  // Attach io to global so API routes can access it
  global.io = io;

  io.on('connection', (socket) => {
    if (process.env.NODE_ENV !== 'production') {
      logger.info(`New socket connection`, { socketId: socket.id });
    }
    
    // Identify user role and id from auth data or JWT token
    let userRole = socket.handshake?.auth?.role || 'anonymous';
    let userId = socket.handshake?.auth?.userId;
    const token = socket.handshake?.auth?.token;

    if (token) {
      try {
        const decoded = verifyToken(token);
        if (decoded) {
          userRole = decoded.role || userRole;
          userId = decoded.id || userId;
        }
      } catch (e) {}
    }

    if (process.env.NODE_ENV !== 'production') {
      logger.info(`Socket authenticated`, { socketId: socket.id, userId, userRole });
    }

    // Track connected clients
    if (userRole === 'student' && userId) {
      connectedClients.students.set(socket.id, { userId, connectedAt: new Date() });
    } else if (userRole === 'faculty' && userId) {
      connectedClients.faculty.set(socket.id, { userId, connectedAt: new Date() });
    } else if (userRole === 'admin' && userId) {
      connectedClients.admin.set(socket.id, { userId, connectedAt: new Date() });
    }

    // Join a specific practical room for real-time updates
    socket.on('join_practical_room', (practicalId) => {
      const room = `practical_${practicalId}`;
      socket.join(room);
      if (process.env.NODE_ENV !== 'production') {
        logger.info(`Socket joined practical room`, { socketId: socket.id, room });
      }
    });

    // Join admin room for real-time system & audit updates
    socket.on('join_admin_room', () => {
      socket.join('admin_room');
      if (process.env.NODE_ENV !== 'production') {
        logger.info(`Socket joined admin room`, { socketId: socket.id });
      }
    });

    socket.on('leave_admin_room', () => {
      socket.leave('admin_room');
      if (process.env.NODE_ENV !== 'production') {
        logger.info(`Socket left admin room`, { socketId: socket.id });
      }
    });

    // Auto-join admin room if authenticated as admin
    if (userRole === 'admin') {
      socket.join('admin_room');
    }

    socket.on('join_course_room', (courseId) => {
      const room = `course_${courseId}`;
      socket.join(room);
      if (process.env.NODE_ENV !== 'production') {
        logger.info(`Socket joined course room`, { socketId: socket.id, room });
      }
    });

    socket.on('leave_course_room', (courseId) => {
      const room = `course_${courseId}`;
      socket.leave(room);
      if (process.env.NODE_ENV !== 'production') {
        logger.info(`Socket left course room`, { socketId: socket.id, room });
      }
    });

    // Faculty practical events — broadcast to specific course room only
    socket.on('faculty_practical_added', (data) => {
      const practical = data?.practical || data;
      const courseId = data?.course_id || practical?.course_id;
      if (courseId) {
        io.to(`course_${courseId}`).emit('practical_added', practical);
      }
      if (process.env.NODE_ENV !== 'production') {
        logger.info(`Broadcasted practical_added`, { courseId, socketId: socket.id });
      }
    });

    socket.on('faculty_practical_updated', (data) => {
      const practical = data?.practical || data;
      const courseId = data?.course_id || practical?.course_id;
      if (courseId) {
        io.to(`course_${courseId}`).emit('practical_updated', practical);
      }
      if (process.env.NODE_ENV !== 'production') {
        logger.info(`Broadcasted practical_updated`, { courseId, socketId: socket.id });
      }
    });

    socket.on('faculty_practical_deleted', (data) => {
      const practicalId = data?.practicalId || data?.id || data;
      const courseId = data?.course_id;
      if (courseId) {
        io.to(`course_${courseId}`).emit('practical_deleted', practicalId);
      }
      if (process.env.NODE_ENV !== 'production') {
        logger.info(`Broadcasted practical_deleted`, { practicalId, courseId, socketId: socket.id });
      }
    });

    socket.on('watch_job', (jobId) => {
      const room = `job_${jobId}`;
      socket.join(room);
      if (process.env.NODE_ENV !== 'production') {
        logger.info(`Socket watching job`, { socketId: socket.id, room });
      }
    });

    socket.on('unwatch_job', (jobId) => {
      const room = `job_${jobId}`;
      socket.leave(room);
      if (process.env.NODE_ENV !== 'production') {
        logger.info(`Socket unwatching job`, { socketId: socket.id, room });
      }
    });

    socket.on('worker_job_complete', (data) => {
      if (process.env.NODE_ENV !== 'production') {
        logger.info(`Job completed`, { jobId: data?.jobId });
      }
      if (data?.jobId) {
        io.to(`job_${data.jobId}`).emit('job_complete', data.result);
        if (process.env.NODE_ENV !== 'production') {
          logger.info(`Emitted job_complete`, { jobId: data.jobId });
        }
      }
    });

    // Student submission events — notify practical room, course room, and globally
    socket.on('student_new_submission', (data) => {
      const submission = data?.submission || data;
      const practicalId = data?.practical_id || submission?.practical_id;
      const courseId = data?.course_id || submission?.course_id;

      if (practicalId) {
        io.to(`practical_${practicalId}`).emit('new_submission', submission);
        if (process.env.NODE_ENV !== 'production') {
          logger.info(`Emitted new_submission to practical room`, { practicalId });
        }
      }
      if (courseId) {
        io.to(`course_${courseId}`).emit('new_submission_marks', { 
          course_id: courseId, 
          practical_id: practicalId 
        });
        if (process.env.NODE_ENV !== 'production') {
          logger.info(`Emitted new_submission_marks to course room`, { courseId });
        }
      }
      io.emit('new_submission', submission);
    });

    socket.on('disconnect', () => {
      // Clean up client tracking
      ['students', 'faculty', 'admin'].forEach(role => {
        if (connectedClients[role].has(socket.id)) {
          const client = connectedClients[role].get(socket.id);
          connectedClients[role].delete(socket.id);
          if (process.env.NODE_ENV !== 'production') {
            logger.info(`Socket disconnected`, { role, socketId: socket.id, userId: client.userId });
          }
        }
      });
      if (process.env.NODE_ENV !== 'production') {
        logger.info(`Socket disconnected`, { socketId: socket.id });
      }
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
});
