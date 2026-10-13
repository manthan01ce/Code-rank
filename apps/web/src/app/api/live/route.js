import { NextResponse } from 'next/server';

// Liveness is deliberately dependency-free. Load balancers can use it to
// distinguish a responsive Node process from a failing database or Redis.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export function GET() {
  return NextResponse.json(
    { status: 'ok', timestamp: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
