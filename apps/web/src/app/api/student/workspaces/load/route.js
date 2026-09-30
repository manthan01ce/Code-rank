import { NextResponse } from 'next/server';
import { SubmissionService } from '@coderank/core/services/SubmissionService';
import { getUserFromRequest } from '@coderank/core/utils/auth';

export async function GET(request) {
  try {
    const user = getUserFromRequest(request);
    const { searchParams } = new URL(request.url);
    const practicalId = searchParams.get('practical_id');

    if (!practicalId) {
      return NextResponse.json({ error: 'practical_id is required' }, { status: 400 });
    }

    const result = await SubmissionService.loadWorkspace(user, parseInt(practicalId));
    return NextResponse.json(result);
  } catch (error) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Load workspace error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
