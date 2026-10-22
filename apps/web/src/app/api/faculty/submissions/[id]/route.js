import { NextResponse } from 'next/server';
import { SubmissionService } from '@coderank/core/services/SubmissionService';
import { authenticateRequest } from '@coderank/core/security/active-actor';
import { decodeBinaryCode } from '@/lib/binaryCode';

export async function GET(request, { params }) {
  try {
    const user = await authenticateRequest(request);
    const { id } = await params;
    const submission = await SubmissionService.getSubmission(user, id);

    return NextResponse.json({
      ...submission,
      code: decodeBinaryCode(submission.code),
    });
  } catch (error) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Fetch submission detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await authenticateRequest(request);
    const { id } = await params;
    const result = await SubmissionService.deleteSubmission(user, id);
    return NextResponse.json(result);
  } catch (error) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Delete submission error:', error);
    return NextResponse.json({ error: 'Failed to delete submission' }, { status: 500 });
  }
}
