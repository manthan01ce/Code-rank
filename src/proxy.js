import { NextResponse } from 'next/server';

const rateLimitMap = new Map();

const LIMITS = {
  login: { windowMs: 60000, max: 5 },       // 5 requests / min
  run: { windowMs: 60000, max: 10 },        // 10 requests / min
  submit: { windowMs: 60000, max: 5 },      // 5 requests / min
  default: { windowMs: 60000, max: 30 },    // 30 requests / min
};

function getLimitCategory(pathname) {
  if (pathname.includes('/api/auth/login')) return 'login';
  if (pathname.includes('-run') || pathname.includes('/api/run')) return 'run';
  if (pathname.includes('/api/submit')) return 'submit';
  return 'default';
}

export function proxy(request) {
  const pathname = request.nextUrl.pathname;

  // Add security headers to response
  const response = NextResponse.next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // Handle CORS
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-compiler-secret');

  // Only apply rate limiting to APIs
  if (pathname.startsWith('/api')) {
    const ip = request.ip || request.headers.get('x-forwarded-for') || '127.0.0.1';
    const category = getLimitCategory(pathname);
    const limit = LIMITS[category];
    const key = `${ip}:${category}`;

    const now = Date.now();
    let timestamps = rateLimitMap.get(key) || [];
    timestamps = timestamps.filter(t => now - t < limit.windowMs);

    if (timestamps.length >= limit.max) {
      return new NextResponse(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil(limit.windowMs / 1000).toString(),
          }
        }
      );
    }

    timestamps.push(now);
    rateLimitMap.set(key, timestamps);
  }

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
