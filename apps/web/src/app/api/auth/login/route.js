import { NextResponse } from 'next/server';
import { UserService } from '@coderank/core/services/UserService';

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const result = await UserService.login(body);
    return NextResponse.json(result);
  } catch (error) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Unhandled Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
