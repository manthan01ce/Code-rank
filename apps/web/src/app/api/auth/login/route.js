/**
 * apps/web/src/app/api/auth/login/route.js
 *
 * Login endpoint with rate-limiting (5 attempts per minute per IP / identifier).
 */
import { NextResponse } from 'next/server';
import { UserService } from '@coderank/core/services/UserService';
import { checkRateLimit } from '@/lib/queue/rateLimiter';

export const maxDuration = 10;

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Rate-limit by email (or fallback to IP header) to prevent brute-force
    const identifier = (body?.email || '').toLowerCase().trim() ||
      (request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
    const rate = await checkRateLimit(identifier, 'login');
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please wait before trying again.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter || 60) } }
      );
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
