import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 50;
    
    // Clean up logs older than 7 days
    await sql`DELETE FROM activity_logs WHERE created_at < NOW() - INTERVAL '7 days'`;

    // Fetch recent logs mapping user details
    const logs = await sql`
      SELECT 
        l.id, l.action, l.details, l.created_at,
        u.name as user_name, u.role as user_role, u.email as user_email
      FROM activity_logs l
      LEFT JOIN users u ON l.user_id = u.id
      WHERE l.action NOT IN ('SAVE_WORKSPACE', 'RUN_CODE', 'VIEW_PRACTICAL', 'VIEW_COURSE')
      ORDER BY l.created_at DESC
      LIMIT ${limit}
    `;

    return NextResponse.json(logs);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
