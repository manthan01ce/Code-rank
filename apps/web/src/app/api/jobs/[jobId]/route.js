/**
 * apps/web/src/app/api/jobs/[jobId]/route.js
 *
 * Returns job status for authenticated users or anonymous callers with a valid
 * session cookie. Hidden test-case data is redacted for students.
 */
import { NextResponse } from 'next/server';
import { getJobStatus } from '@/lib/queue/jobQueue';
import { getUserFromRequest } from '@coderank/core/utils/auth';

export const maxDuration = 10;

export async function GET(request, { params }) {
  try {
    const { jobId } = await params;
    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const caller = getUserFromRequest(request);

    // Read anonymous session cookie (HttpOnly, set at job-creation time)
    const cookieHeader = request.headers.get('cookie') || '';
    const anonMatch = cookieHeader.match(/(?:^|;\s*)anon_session=([^;]+)/);
    const anonSessionId = anonMatch ? anonMatch[1] : null;

    const job = await getJobStatus(jobId, caller, anonSessionId);

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.forbidden) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json(job);
  } catch (error) {
    console.error('GET /api/jobs/[jobId] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
