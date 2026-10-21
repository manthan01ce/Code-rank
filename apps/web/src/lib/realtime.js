import { publicResult } from '@coderank/core/security/execution';

const MAX_SUBSCRIPTIONS = 64;

export async function revalidateRealtimeRooms(socket, { actor, authorizePractical, authorizeCourse, getJobStatus }) {
  const rooms = socket.data.subscriptionRooms;
  if (!rooms) return;
  // The subscription limit also bounds the work on each periodic refresh.
  await Promise.all([...rooms].map(async room => {
    try {
      if (room.startsWith('practical_')) await authorizePractical(actor, Number(room.slice(10)));
      else if (room.startsWith('course_')) await authorizeCourse(actor, Number(room.slice(7)));
      else if (room.startsWith('job_') && !await getJobStatus(room.slice(4), actor)) throw new Error('Job expired');
    } catch {
      rooms.delete(room);
      await socket.leave(room);
    }
  }));
}

// Authentication is performed before this handler. Authorization is rechecked
// for subscriptions; service publishers cannot subscribe to browser job rooms.
export function attachRealtime(io, socket, { authorizePractical, authorizeCourse, getJobStatus, refreshActor, validateService }) {
  let actor = socket.data.actor;
  const service = socket.data.service === true;
  const rooms = socket.data.subscriptionRooms = new Set();
  const join = async room => {
    if (!rooms.has(room) && rooms.size >= MAX_SUBSCRIPTIONS) throw new Error('Subscription limit reached');
    // Reserve before awaiting Socket.IO so concurrent events cannot bypass the cap.
    rooms.add(room);
    try { await socket.join(room); }
    catch (error) { rooms.delete(room); throw error; }
  };
  const handle = (event, fn) => socket.on(event, async (payload, ack) => {
    try {
      if (service) {
        if (validateService && !await validateService()) {
          socket.disconnect?.(true);
          throw new Error('Service session expired');
        }
      } else if (refreshActor) {
        try { actor = await refreshActor(); }
        catch (error) { socket.disconnect?.(true); throw error; }
      }
      await fn(payload);
      if (typeof ack === 'function') ack({ ok: true });
    } catch {
      if (typeof ack === 'function') ack({ ok: false, error: 'Access denied' });
    }
  });
  const id = value => {
    if (!/^\d+$/.test(String(value)) || Number(value) <= 0) throw new Error('Invalid ID');
    return Number(value);
  };
  handle('join_practical_room', async value => {
    if (service) throw new Error('Browser authentication required');
    await authorizePractical(actor, id(value));
    await join(`practical_${id(value)}`);
  });
  handle('join_course_room', async value => {
    if (service) throw new Error('Browser authentication required');
    await authorizeCourse(actor, id(value));
    await join(`course_${id(value)}`);
  });
  handle('watch_job', async jobId => {
    if (service) throw new Error('Browser authentication required');
    if (typeof jobId !== 'string' || jobId.length > 100 || !await getJobStatus(jobId, actor)) throw new Error('Invalid job');
    await join(`job_${jobId}`);
  });
  for (const [event, prefix] of [['leave_practical_room', 'practical'], ['leave_course_room', 'course'], ['unwatch_job', 'job']]) {
    handle(event, async value => {
      if (typeof value !== 'string' && typeof value !== 'number') return;
      rooms.delete(`${prefix}_${value}`);
      await socket.leave(`${prefix}_${value}`);
    });
  }
  handle('worker_job_complete', async data => {
    if (!service || typeof data?.jobId !== 'string') throw new Error('Service authentication required');
    io.to(`job_${data.jobId}`).emit('job_complete', { ...publicResult(data.result), jobId: data.jobId });
  });
  // Compatibility for trusted API relays. Browser writes use HTTP APIs.
  for (const [event, outbound] of [['faculty_practical_added', 'practical_added'], ['faculty_practical_updated', 'practical_updated'], ['faculty_practical_deleted', 'practical_deleted']]) {
    handle(event, async data => {
      if (!service) throw new Error('Service authentication required');
      const courseId = id(data?.course_id);
      io.to(`course_${courseId}`).emit(outbound, outbound === 'practical_deleted' ? data.practicalId : data.practical);
    });
  }
  // No client-supplied student_new_submission handler: persisted jobs are the
  // authority and clients already poll their authorized dashboard endpoints.
}
