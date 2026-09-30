import { NextResponse } from 'next/server';
import { UserService } from '@coderank/core/services/UserService';
import { getUserFromRequest } from '@coderank/core/utils/auth';

export async function POST(request) {
  try {
    const user = getUserFromRequest(request);
    const body = await request.json();
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
