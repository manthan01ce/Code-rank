import { NextResponse } from 'next/server';
import { UserService } from '@coderank/core/services/UserService';

export async function GET(request, { params }) {
  try {
    const { username } = await params;
    const result = await UserService.getStudentProfileByUsername(username);
    return NextResponse.json(result);
  } catch (error) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('GET /api/profile/[username] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
