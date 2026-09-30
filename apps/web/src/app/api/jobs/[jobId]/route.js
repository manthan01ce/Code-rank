import { NextResponse } from 'next/server';
import { SubmissionService } from '@coderank/core/services/SubmissionService';

export async function GET(request, { params }) {
  try {
    const { jobId } = await params;
    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const job = await SubmissionService.getJobStatus(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (error) {
    console.error('GET /api/jobs/[jobId] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
