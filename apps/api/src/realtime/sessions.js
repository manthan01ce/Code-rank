import sql from '@coderank/database';
import { authenticateToken } from '@coderank/core/security/active-actor';
import { verifyServiceToken } from '@coderank/core/security/service-token';
import { guestActor } from '@coderank/core/security/execution';
import { PracticalService } from '@coderank/core/services/PracticalService';
import { SubmissionService } from '@coderank/core/services/SubmissionService';

/**
 * Socket.IO authentication middleware.
 * Authenticates service tokens, user JWTs, or guest cookies.
 */
export async function socketAuthMiddleware(socket, next, options = {}) {
  try {
    const authenticateTokenFn = options.authenticateToken || authenticateToken;
    const guestActorFn = options.guestActor || guestActor;
    const serviceToken = socket.handshake.auth?.serviceToken;
    const token = socket.handshake.auth?.token;
    const service = serviceToken !== undefined ? verifyServiceToken(serviceToken) : null;
    if (serviceToken !== undefined && !service) throw new Error('Invalid service credentials');

    const actor = token !== undefined
      ? await authenticateTokenFn(token)
      : service
        ? null
        : guestActorFn(socket.handshake.headers.cookie || '');

    if (!service && !actor) throw new Error('Authentication required');

    socket.data.service = !!service;
    socket.data.actor = actor;
    socket.data.token = token;
    socket.data.serviceToken = serviceToken;
    socket.data.expiresAt = service
      ? service.exp * 1000
      : actor.role === 'guest'
        ? Date.now() + 86400000
        : actor.exp * 1000;

    next();
  } catch {
    next(new Error('Authentication required'));
  }
}

/**
 * Authorize course access for faculty, students, or admin.
 */
export async function authorizeCourse(actor, id) {
  if (!actor || actor.role === 'guest') throw new Error('Authentication required');
  if (actor.role === 'admin') return;
  const rows = actor.role === 'faculty'
    ? await sql`SELECT 1 FROM course_faculty WHERE course_id = ${id} AND faculty_id = ${actor.id}`
    : await sql`SELECT 1 FROM users u JOIN courses c ON c.semester = (u.extra_info->>'semester')::int WHERE u.id = ${actor.id} AND u.status = 'active' AND c.id = ${id} AND (u.session_token IS NULL OR u.session_token = ${actor.session_token || ''})`;
  if (!rows.length) throw new Error('Course access denied');
}

/**
 * Create authorization callbacks for a connected socket.
 */
export function createAuthorization(socket, options = {}) {
  const authenticateTokenFn = options.authenticateToken || authenticateToken;
  return {
    refreshActor: () => (socket.data.actor?.role === 'guest' ? socket.data.actor : authenticateTokenFn(socket.data.token)),
    validateService: () => !!verifyServiceToken(socket.data.serviceToken),
    authorizePractical: (actor, id) => PracticalService.authorize(actor, id),
    getJobStatus: (id, actor) => SubmissionService.getJobStatus(id, actor),
    authorizeCourse: (actor, id) => authorizeCourse(actor, id),
  };
}

/**
 * Revalidate room subscriptions periodically.
 */
export async function revalidateRealtimeRooms(socket, { actor, authorizePractical, authorizeCourse, getJobStatus }) {
  const rooms = socket.data.subscriptionRooms;
  if (!rooms) return;
  await Promise.all(
    [...rooms].map(async (room) => {
      try {
        if (room.startsWith('practical_')) await authorizePractical(actor, Number(room.slice(10)));
        else if (room.startsWith('course_')) await authorizeCourse(actor, Number(room.slice(7)));
        else if (room.startsWith('job_') && !(await getJobStatus(room.slice(4), actor))) throw new Error('Job expired');
      } catch {
        rooms.delete(room);
        await socket.leave(room);
      }
    }),
  );
}

/**
 * Bound the lifetime of idle subscriptions as well as incoming events.
 */
export function guardRealtimeSession(socket, {
  revalidate,
  expiresAt,
  intervalMs = 30000,
  now = Date.now,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  let closed = false;
  let refreshTimer;
  let expiryTimer;

  const close = () => {
    closed = true;
    if (refreshTimer) clearTimer(refreshTimer);
    if (expiryTimer) clearTimer(expiryTimer);
  };

  const revoke = () => {
    if (closed) return;
    close();
    socket.disconnect(true);
  };

  const refresh = async () => {
    if (closed) return;
    try {
      await revalidate();
    } catch {
      revoke();
      return;
    }
    if (!closed) schedule();
  };

  const schedule = () => {
    refreshTimer = setTimer(refresh, intervalMs);
    refreshTimer.unref?.();
  };

  socket.on('disconnect', close);

  if (Number.isFinite(expiresAt)) {
    expiryTimer = setTimer(revoke, Math.max(0, Math.min(2147483647, expiresAt - now())));
    expiryTimer.unref?.();
  }

  if (revalidate) schedule();
  return close;
}
