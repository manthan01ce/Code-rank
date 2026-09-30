import { NextResponse } from 'next/server';
import sql from '@coderank/core/db';
import { SubmissionService } from '@coderank/core/services/SubmissionService';

export async function GET() {
  const report = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: { status: 'unknown' },
      queue: { status: 'unknown' }
    }
  };

  try {
    const dbResult = await sql`SELECT 1 as active`;
    if (dbResult && dbResult[0]?.active === 1) {
      report.services.database.status = 'healthy';
    } else {
      report.services.database.status = 'unhealthy';
      report.status = 'unhealthy';
    }
  } catch (dbErr) {
    report.services.database.status = 'unhealthy';
    report.services.database.error = dbErr.message;
    report.status = 'unhealthy';
  }

  try {
    const queueStats = await SubmissionService.getQueueStats();
    report.services.queue.status = 'healthy';
    report.services.queue.stats = queueStats;
  } catch (queueErr) {
    report.services.queue.status = 'degraded';
    report.services.queue.error = queueErr.message;
  }

  return NextResponse.json(report, { status: report.status === 'healthy' ? 200 : 500 });
}
