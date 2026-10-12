import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function POST(request) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    let { practical_id, code, language } = body;

    if (!practical_id || code === undefined || code === null || !language) {
      return NextResponse.json({ error: 'practical_id, code, and language are required' }, { status: 400 });
    }

    // Strip 'practical_' prefix if present (e.g. 'practical_5' → 5)
    if (typeof practical_id === 'string' && practical_id.startsWith('practical_')) {
      practical_id = practical_id.replace('practical_', '');
    }
    const practicalId = parseInt(practical_id, 10);
    if (isNaN(practicalId)) {
      return NextResponse.json({ error: 'Invalid practical_id' }, { status: 400 });
    }

    await sql`
      INSERT INTO student_workspaces (student_id, practical_id, language, latest_code, saved_at)
      VALUES (${user.id}, ${practicalId}, ${language}, ${code}, NOW())
      ON CONFLICT (student_id, practical_id, language)
      DO UPDATE SET latest_code = EXCLUDED.latest_code, saved_at = NOW()
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Save workspace error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
