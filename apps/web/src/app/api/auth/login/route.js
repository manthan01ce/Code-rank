import { requestTiming } from '@coderank/core/utils/request-timing';
import { checkRateLimit } from '@/lib/queue/rateLimiter';
import { NextResponse } from 'next/server';
import { UserService } from '@coderank/core/services/UserService';

export async function POST(request) {
  const timing = requestTiming();
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
    const rateStart = performance.now();
    const rate = await checkRateLimit(body.email.trim().toLowerCase(), 'login');
    timing.record('rate_limit', performance.now() - rateStart);
    if (rate.unavailable) return NextResponse.json(
      {error: 'Sign-in is temporarily unavailable. Please try again shortly.'},
      {status: 503, headers: {'Retry-After': '5', 'Cache-Control': 'no-store', 'Server-Timing': timing.header()}});
    if (!rate.allowed) return NextResponse.json(
      {error: 'Too many login attempts. Please wait before trying again.'},
      {status: 429, headers: {'Retry-After': String(rate.retryAfter || 60), 'Cache-Control': 'no-store', 'Server-Timing': timing.header()}});
    const result = await UserService.login(body, {onTiming: timing.record});
    return NextResponse.json(result, {headers: {'Cache-Control': 'no-store', 'Server-Timing': timing.header()}});
  } catch (error) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: {'Cache-Control': 'no-store', 'Server-Timing': timing.header(), ...(error.status === 503 ? {'Retry-After': '5'} : {})} });
    }
    console.error('Unhandled Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
