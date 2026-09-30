import { NextResponse } from 'next/server';
import { SubmissionService } from '@coderank/core/services/SubmissionService';

export async function GET() {
  try {
    const stats = await SubmissionService.getQueueStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('GET /api/queue/stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
