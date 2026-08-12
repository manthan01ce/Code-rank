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
    const practical_id = searchParams.get('practical_id');
    const language = searchParams.get('language');

    if (!practical_id || !language) {
      return NextResponse.json({ error: 'Missing required query parameters' }, { status: 400 });
    }

    const workspace = await sql`
      SELECT latest_code 
      FROM student_workspaces 
      WHERE student_id = ${user.id} AND practical_id = ${parseInt(practical_id)} AND language = ${language}
    `;

    if (workspace.length === 0) {
      return NextResponse.json({ latest_code: null });
    }

    let code = workspace[0].latest_code;
    if (Buffer.isBuffer(code)) {
      code = code.toString('utf8');
    }
    return NextResponse.json({ latest_code: code });
  } catch (error) {
    console.error('Load workspace error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}
