import { jsonBody } from '@/lib/route-response';
import { NextResponse } from 'next/server';
import { UserService } from '@coderank/core/services/UserService';
import { authenticateRequest } from '@coderank/core/security/active-actor';

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = await jsonBody(request);
    const result = await UserService.changePassword(user, body);
    return NextResponse.json(result);
  } catch (error) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Change password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
