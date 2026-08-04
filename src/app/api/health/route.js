import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET() {
  const report = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: { status: 'unknown' },
      docker: { status: 'unknown' }
    }
  };

  // 1. Database check
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

  // 2. Docker check
  try {
    const { stdout } = await execAsync('docker --version');
    if (stdout && stdout.trim()) {
      report.services.docker.status = 'healthy';
      report.services.docker.version = stdout.trim();
    } else {
      report.services.docker.status = 'unhealthy';
      report.status = 'unhealthy';
    }
  } catch (dockerErr) {
    report.services.docker.status = 'unhealthy';
    report.services.docker.error = dockerErr.message;
    report.status = 'unhealthy';
  }

  return NextResponse.json(report, { status: report.status === 'healthy' ? 200 : 500 });
}
