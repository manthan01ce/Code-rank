import { authenticateRequest } from '@coderank/core/security/active-actor';
import { NextResponse } from 'next/server';
import { UserService } from '@coderank/core/services/UserService';

export async function GET(request, { params }) {
  try {
    if (!(await authenticateRequest(request))) return NextResponse.json({error:'Unauthorized'},{status:401});
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

export async function PUT(request) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const result = await UserService.updateProfile(user, body);
    return NextResponse.json(result);
  } catch (error) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('PUT /api/profile/[username] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
