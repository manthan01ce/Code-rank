import { NextResponse } from 'next/server';
import { executionActor, executionError } from '@/lib/execution-api';
import { SubmissionService } from '@coderank/core/services/SubmissionService';

export async function GET(request, { params }) {
  try {
    const { jobId } = await params;
    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const job = await SubmissionService.getJobStatus(jobId, await executionActor(request));
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json(job, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return executionError(error);
  }
}
