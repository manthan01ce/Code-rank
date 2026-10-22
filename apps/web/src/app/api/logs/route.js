import { NextResponse } from 'next/server';
import sql from '@coderank/core/db';
import { authenticateRequest } from '@coderank/core/security/active-actor';

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedLimit = Number.parseInt(searchParams.get('limit') || '50', 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 50;

    const logs = await sql`
      SELECT al.id, al.user_id, al.action, al.details, al.created_at,
             u.name AS user_name, u.email AS user_email
      FROM activity_logs al
      LEFT JOIN users u ON u.id = al.user_id
      ORDER BY al.created_at DESC
      LIMIT ${limit}
    `;

    return NextResponse.json(logs);
  } catch (error) {
    if (error.status) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('GET /api/logs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
