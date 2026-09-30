import { NextResponse } from 'next/server';
import { SubmissionService } from '@coderank/core/services/SubmissionService';
import { getUserFromRequest } from '@coderank/core/utils/auth';

export async function POST(request) {
  try {
    const user = getUserFromRequest(request);
    const body = await request.json();
    const result = await SubmissionService.saveWorkspace(user, body);
    return NextResponse.json(result);
  } catch (error) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Save workspace error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
