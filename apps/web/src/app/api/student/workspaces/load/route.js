import { NextResponse } from 'next/server';
import { SubmissionService } from '@coderank/core/services/SubmissionService';
import { authenticateRequest } from '@coderank/core/security/active-actor';

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    const params = new URL(request.url).searchParams;
    return NextResponse.json(await SubmissionService.loadWorkspace(user, params.get('practical_id'), params.get('language')));
  } catch (error) {
    return NextResponse.json({ error: error.status ? error.message : 'Internal server error' }, { status: error.status || 500 });
  }
}
