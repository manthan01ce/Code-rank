import { createServiceToken } from '@coderank/core/security/service-token';
import { publicResult } from '@coderank/core/security/execution';
import sql from '@coderank/core/db';
import { io } from 'socket.io-client';

export function createWorkerPublisher() {
  const socket = io(process.env.REALTIME_URL || process.env.INTERNAL_API_URL || `http://127.0.0.1:${process.env.API_PORT || 3001}`, { transports: ['websocket'], auth: callback => callback({ serviceToken: createServiceToken() }) });
  let realtimeClosed = false;
  socket.on('disconnect', reason => {
    // Socket.IO does not reconnect an explicit server disconnect. A fresh
    // connection runs the auth callback again and replaces an expired token.
    // Authentication rejection raises connect_error, which we do not retry here.
    if (reason === 'io server disconnect' && !realtimeClosed) socket.connect();
  });
  const disconnectRealtime = () => { realtimeClosed = true; socket.disconnect(); };

  const completed = async (job, result) => {
    socket.emit('worker_job_complete', { jobId: job.id, result: publicResult(result) });
    if (result?.submissionId) {
      try {
        const [saved] = await sql`SELECT ps.practical_id, p.course_id FROM practical_submissions ps
          JOIN practicals p ON p.id=ps.practical_id WHERE ps.id=${result.submissionId} AND ps.student_id=${job.data.userId}`;
        if (saved) socket.emit('worker_submission_saved', { practicalId: saved.practical_id, courseId: saved.course_id });
      } catch (error) { console.error('Submission refresh notification failed', error.code || 'unavailable'); }
    }
  };
  const failed = (job) => {
      socket.emit('worker_job_complete', {
        jobId: job.id,
        result: {
          status: 'internal_error',
          summary: 'Execution failed internally',
          runtimeError: 'Execution failed internally'
        }
      });
  };
  return { socket, disconnectRealtime, completed, failed };
}
