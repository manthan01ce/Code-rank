import { NextResponse } from 'next/server';
import { UserService } from '@coderank/core/services/UserService';
import { getUserFromRequest } from '@coderank/core/utils/auth';

export async function GET(request) {
  try {
    const user = getUserFromRequest(request);
    const profile = await UserService.getProfile(user);
    return NextResponse.json({ user: profile });
  } catch (error) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('GET /api/auth/profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const user = getUserFromRequest(request);
    const body = await request.json();
    const result = await UserService.updateProfile(user, body);
    return NextResponse.json(result);
  } catch (error) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('PUT /api/auth/profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
