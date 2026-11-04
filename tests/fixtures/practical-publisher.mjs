import { io as socketClient } from 'socket.io-client';
import { createServiceToken } from '@coderank/core/security/service-token';

export function publishPractical(action, practical) {
  const deleted = action === 'deleted';
  try {
    const realtimeUrl = process.env.REALTIME_URL || process.env.INTERNAL_API_URL || `http://127.0.0.1:${process.env.API_PORT || 3001}`;
    const socket = socketClient(realtimeUrl, {
      transports: ['websocket'],
      forceNew: true,
      auth: callback => callback({ serviceToken: createServiceToken() }),
      reconnection: false,
      timeout: 1000,
    });
    socket.emit(`faculty_practical_${action}`, deleted ? { course_id: practical.course_id, practicalId: practical.id } : { course_id: practical.course_id, practical });
    const timer = setTimeout(() => socket.disconnect(), 1500);
    timer.unref?.();
    return socket;
  } catch (error) {
    console.warn('Practical notification failed:', error.message);
  }
}
