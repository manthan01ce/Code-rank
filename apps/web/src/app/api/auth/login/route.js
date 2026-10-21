import { checkRateLimit } from '@/lib/queue/rateLimiter';
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

    if (typeof body?.email !== 'string' || body.email.length > 254 || typeof body.password !== 'string' || body.password.length > 1024) {
      return NextResponse.json({ error: 'Invalid login payload' }, { status: 400 });
    }
    const rate = await checkRateLimit(body.email.trim().toLowerCase(), 'login');
    if (!rate.allowed) return NextResponse.json({ error: 'Too many login attempts. Please wait 1 minute before trying again.' }, { status: 429 });
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
