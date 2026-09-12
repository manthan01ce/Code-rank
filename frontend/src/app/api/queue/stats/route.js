import { NextResponse } from 'next/server';
import { codeExecutionQueue } from '@/lib/queue/jobQueue';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      codeExecutionQueue.getWaitingCount(),
      codeExecutionQueue.getActiveCount(),
      codeExecutionQueue.getCompletedCount(),
      codeExecutionQueue.getFailedCount(),
      codeExecutionQueue.getDelayedCount(),
      codeExecutionQueue.getPausedCount()
    ]);

    return NextResponse.json({
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
      maxConcurrent: parseInt(process.env.MAX_CONCURRENT_JOBS || '2', 10)
    });
  } catch (error) {
    console.error('Queue stats error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
