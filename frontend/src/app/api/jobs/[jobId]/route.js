import { NextResponse } from 'next/server';
import { getJobStatus } from '@/lib/queue/jobQueue';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request, { params }) {
  try {
    // Since this is app router, we await params
    const resolvedParams = await params;
    const { jobId } = resolvedParams;
    
    const status = await getJobStatus(jobId);

    if (!status) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    return NextResponse.json(status);
  } catch (error) {
    console.error('Error fetching job status:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
