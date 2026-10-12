import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let practicalIdRaw = searchParams.get('practical_id');
    const language = searchParams.get('language');

    if (!practicalIdRaw) {
      return NextResponse.json({ error: 'practical_id is required' }, { status: 400 });
    }

    // Strip 'practical_' prefix if present (e.g. 'practical_5' → 5)
    if (typeof practicalIdRaw === 'string' && practicalIdRaw.startsWith('practical_')) {
      practicalIdRaw = practicalIdRaw.replace('practical_', '');
    }
    const practicalId = parseInt(practicalIdRaw, 10);
    if (isNaN(practicalId)) {
      return NextResponse.json({ error: 'Invalid practical_id' }, { status: 400 });
    }

    let rows;
    if (language) {
      rows = await sql`
        SELECT convert_from(latest_code, 'UTF8') as code, language, saved_at
        FROM student_workspaces 
        WHERE student_id = ${user.id} AND practical_id = ${practicalId} AND language = ${language}
        ORDER BY saved_at DESC LIMIT 1
      `;
    } else {
      rows = await sql`
        SELECT convert_from(latest_code, 'UTF8') as code, language, saved_at
        FROM student_workspaces 
        WHERE student_id = ${user.id} AND practical_id = ${practicalId}
        ORDER BY saved_at DESC LIMIT 1
      `;
    }

    if (rows.length === 0) {
      return NextResponse.json({ code: '', language: language || 'python', latest_code: null });
    }

    const codeStr = rows[0].code || '';
    return NextResponse.json({
      code: codeStr,
      latest_code: codeStr,
      language: rows[0].language,
      saved_at: rows[0].saved_at,
    });
  } catch (error) {
    console.error('Load workspace error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
