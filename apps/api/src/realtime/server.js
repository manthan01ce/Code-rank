import fp from 'fastify-plugin';
import { withTimeout } from '@coderank/core/utils/timeout';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import { publicResult } from '@coderank/core/security/execution';
import {
  socketAuthMiddleware,
  createAuthorization,
  guardRealtimeSession,
  revalidateRealtimeRooms,
} from './sessions.js';
import { createRealtimePublisher } from './publisher.js';

const MAX_SUBSCRIPTIONS = 64;

/**
 * Configure Redis adapter for horizontal scaling across API instances.
 */
export async function configureRealtimeAdapter(io, env = process.env) {
  if (env.REALTIME_REDIS_ENABLED !== 'true') return async () => {};
  const pub = createClient({
    socket: {
      host: env.REDIS_HOST || '127.0.0.1',
      port: Number(env.REDIS_PORT || 6379),
      connectTimeout: 2000,
      reconnectStrategy: retries => (retries > 3 ? false : Math.min(250 * (retries + 1), 1000)),
    },
  });
  const sub = pub.duplicate();
  for (const client of [pub, sub]) {
    client.on('error', error => console.error('Realtime Redis unavailable:', error.message));
  }
  const close = async () => {
    await Promise.all([pub, sub].map(async c => {
      if (c.isOpen) {
        try {
          await withTimeout(c.close(), 2000);
        } catch {
          if (c.isOpen) c.destroy();
        }
      }
    }));
  };
  try {
    await Promise.all([pub.connect(), sub.connect()]);
    io.adapter(createAdapter(pub, sub, { requestsTimeout: 3000 }));
    return close;
  } catch (error) {
    await close();
    throw error;
  }
}

/**
 * Attach realtime event handlers and room management to a connected socket.
 */
export function attachRealtime(io, socket, {
  authorizePractical,
  authorizeCourse,
  getJobStatus,
  refreshActor,
  validateService,
  trackOperation = work => work(),
}) {
  let actor = socket.data.actor;
  const service = socket.data.service === true;
  const rooms = (socket.data.subscriptionRooms = new Set());

  const join = async (room) => {
    if (!rooms.has(room) && rooms.size >= MAX_SUBSCRIPTIONS) throw new Error('Subscription limit reached');
    rooms.add(room);
    try {
      await socket.join(room);
    } catch (error) {
      rooms.delete(room);
      throw error;
    }
  };

  const handle = (event, fn) => socket.on(event, (payload, ack) => trackOperation(async () => {
    try {
      if (socket.connected === false) throw new Error('Socket closed');
      if (service) {
        if (validateService && !(await validateService())) {
          socket.disconnect?.(true);
          throw new Error('Service session expired');
        }
      } else if (refreshActor) {
        try {
          actor = await refreshActor();
        } catch (error) {
          socket.disconnect?.(true);
          throw error;
        }
      }
      if (socket.connected === false) throw new Error('Socket closed');
      await fn(payload);
      if (typeof ack === 'function') ack({ ok: true });
    } catch {
      if (typeof ack === 'function') ack({ ok: false, error: 'Access denied' });
    }
  }));

  const id = (value) => {
    if (!/^\d+$/.test(String(value)) || Number(value) <= 0) throw new Error('Invalid ID');
    return Number(value);
  };

  handle('join_practical_room', async (value) => {
    if (service) throw new Error('Browser authentication required');
    await authorizePractical(actor, id(value));
    await join(`practical_${id(value)}`);
  });

  handle('join_course_room', async (value) => {
    if (service) throw new Error('Browser authentication required');
    await authorizeCourse(actor, id(value));
    await join(`course_${id(value)}`);
  });

  handle('watch_job', async (jobId) => {
    if (service) throw new Error('Browser authentication required');
    if (typeof jobId !== 'string' || jobId.length > 100 || !(await getJobStatus(jobId, actor))) {
      throw new Error('Invalid job');
    }
    await join(`job_${jobId}`);
  });

  for (const [event, prefix] of [
    ['leave_practical_room', 'practical'],
    ['leave_course_room', 'course'],
    ['unwatch_job', 'job'],
  ]) {
    handle(event, async (value) => {
      if (typeof value !== 'string' && typeof value !== 'number') return;
      rooms.delete(`${prefix}_${value}`);
      await socket.leave(`${prefix}_${value}`);
    });
  }

  handle('worker_job_complete', async (data) => {
    if (!service || typeof data?.jobId !== 'string') throw new Error('Service authentication required');
    io.to(`job_${data.jobId}`).emit('job_complete', { ...publicResult(data.result), jobId: data.jobId });
  });

  handle('worker_submission_saved', async (data) => {
    if (!service) throw new Error('Service authentication required');
    const practicalId = id(data?.practicalId);
    const courseId = id(data?.courseId);
    io.to(`practical_${practicalId}`).emit('new_submission', { practicalId });
    io.to(`course_${courseId}`).emit('new_submission_marks', { practicalId, courseId });
  });

  for (const [event, outbound] of [
    ['faculty_practical_added', 'practical_added'],
    ['faculty_practical_updated', 'practical_updated'],
    ['faculty_practical_deleted', 'practical_deleted'],
  ]) {
    handle(event, async (data) => {
      if (!service) throw new Error('Service authentication required');
      const courseId = id(data?.course_id);
      io.to(`course_${courseId}`).emit(outbound, outbound === 'practical_deleted' ? data.practicalId : data.practical);
    });
  }
}

/**
 * Fastify plugin: setup and attach Socket.IO server to the Fastify HTTP server.
 */
export async function setupRealtime(fastifyApp, options = {}) {
  const allowedOrigins = (process.env.ALLOWED_ORIGIN || `http://localhost:${process.env.PORT || 3000}`)
    .split(',')
    .map(v => v.trim());

  const io = new Server(fastifyApp.server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 10000,
    maxHttpBufferSize: 1e6, // 1MB
    transports: ['websocket'],
    ...options,
  });

  const closeAdapter = await configureRealtimeAdapter(io);
  const publisher = createRealtimePublisher(io);
  const inFlight = new Set();
  const trackOperation = work => {
    const task = Promise.resolve().then(work);
    inFlight.add(task);
    task.then(() => inFlight.delete(task), () => inFlight.delete(task));
    return task;
  };

  io.use((socket, next) => socketAuthMiddleware(socket, next, options));

  io.on('connection', (socket) => {
    const authorization = { ...createAuthorization(socket, options), ...options.authorization, trackOperation };
    attachRealtime(io, socket, authorization);
    guardRealtimeSession(socket, {
      expiresAt: socket.data.expiresAt,
      revalidate: !socket.data.service
        ? () => trackOperation(async () => {
          if (!socket.connected) return;
          if (socket.data.actor?.role !== 'guest') {
            const authFn = options.authenticateToken || (await import('@coderank/core/security/active-actor')).authenticateToken;
            socket.data.actor = await authFn(socket.data.token);
          }
          if (!socket.connected) return;
          await revalidateRealtimeRooms(socket, { ...authorization, actor: socket.data.actor });
        })
        : undefined,
    });
  });

  // Close upgraded connections before Fastify waits for its HTTP listener.
  // No private httpServer mutation and no forced process exit to hide leaks.
  fastifyApp.addHook('preClose', async () => {
    io.local.disconnectSockets(true);
    io.engine.close();
    await withTimeout(Promise.allSettled([...inFlight]), 5000);
  });
  let closing;
  const close = () => {
    closing ||= (async () => {
      try { await withTimeout(io.close(), 2000); }
      finally { await closeAdapter(); }
    })();
    return closing;
  };
  fastifyApp.addHook('onClose', close);

  fastifyApp.decorate('io', io);
  fastifyApp.decorate('publisher', publisher);

  return { io, publisher, close };
}

export default fp(setupRealtime, { name: 'coderank-realtime', fastify: '5.x' });

export {
  guardRealtimeSession,
  revalidateRealtimeRooms,
  socketAuthMiddleware,
  createRealtimePublisher,
};
