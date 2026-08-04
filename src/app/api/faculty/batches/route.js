import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await sql`
      SELECT DISTINCT extra_info->>'batch' as batch 
      FROM users 
      WHERE role = 'student' 
        AND status = 'active' 
        AND extra_info->>'batch' IS NOT NULL 
        AND extra_info->>'batch' != ''
      ORDER BY batch DESC
    `;

    const batches = result.map(r => r.batch);
    return NextResponse.json(batches);
  } catch (error) {
    console.error('Fetch batches error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
