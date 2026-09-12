import { NextResponse } from 'next/server';

export function proxy(request) {
  const pathname = request.nextUrl.pathname;

  // Next.js handles CORS for API routes if set in next.config.js, 
  // but if doing it in middleware:
  const response = NextResponse.next();
  
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // Handle CORS
  const origin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-compiler-secret');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Max-Age', '86400'); // Cache preflight 24h

  // Note: Rate limiting is now handled via Redis in individual route handlers

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
