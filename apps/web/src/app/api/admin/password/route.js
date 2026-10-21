import { NextResponse } from 'next/server';
import { authenticateRequest } from '@coderank/core/security/active-actor';
import { UserService } from '@coderank/core/services/UserService';

export async function POST(request) {
  try {
    const admin = await authenticateRequest(request);
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();
    const result = await UserService.changePassword(admin, { currentPassword, newPassword });
    return NextResponse.json(result);
  } catch (error) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Password change error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
