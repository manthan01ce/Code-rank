import { publicResult } from '@coderank/core/security/execution';

/**
 * Explicit API-local event publisher.
 * Provides typed broadcast helpers that publish directly to Socket.IO rooms.
 */
export function createRealtimePublisher(io) {
  return {
    /**
     * Broadcast execution job completion to the job room.
     */
    publishJobComplete(jobId, result) {
      if (!io || typeof jobId !== 'string') return;
      try {
        io.to(`job_${jobId}`).emit('job_complete', {
          ...publicResult(result),
          jobId,
        });
      } catch (error) {
        console.warn('Realtime publishJobComplete failed:', error.message);
      }
    },

    /**
     * Broadcast submission persistence notification to practical and course rooms.
     */
    publishSubmissionSaved({ practicalId, courseId }) {
      if (!io) return;
      try {
        const pId = Number(practicalId);
        const cId = Number(courseId);
        if (Number.isSafeInteger(pId) && pId > 0) {
          io.to(`practical_${pId}`).emit('new_submission', { practicalId: pId });
        }
        if (Number.isSafeInteger(cId) && cId > 0) {
          io.to(`course_${cId}`).emit('new_submission_marks', { practicalId: pId, courseId: cId });
        }
      } catch (error) {
        console.warn('Realtime publishSubmissionSaved failed:', error.message);
      }
    },

    /**
     * Broadcast practical addition, update, or deletion to the course room.
     */
    publishPracticalChange(action, { courseId, practical, practicalId }) {
      if (!io) return;
      try {
        const cId = Number(courseId);
        if (!Number.isSafeInteger(cId) || cId <= 0) return;
        const outbound = action === 'deleted'
          ? 'practical_deleted'
          : action === 'updated'
            ? 'practical_updated'
            : 'practical_added';
        const payload = action === 'deleted' ? practicalId : practical;
        io.to(`course_${cId}`).emit(outbound, payload);
      } catch (error) {
        console.warn('Realtime publishPracticalChange failed:', error.message);
      }
    },
  };
}
