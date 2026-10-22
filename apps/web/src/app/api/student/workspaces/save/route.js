import { NextResponse } from 'next/server';
import { SubmissionService } from '@coderank/core/services/SubmissionService';
import { authenticateRequest } from '@coderank/core/security/active-actor';

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    return NextResponse.json(await SubmissionService.saveWorkspace(user, await request.json()));
  } catch (error) {
    return NextResponse.json({ error: error.status ? error.message : 'Internal server error' }, { status: error.status || 500 });
  }
}
