/**
 * PURPOSE OF THIS FILE:
 * API endpoint GET /api/student/practicals/[id]/submissions.
 * Authenticates user credentials and retrieves previous submission history log records
 * specifically filtered for the selected active practical ID.
 */
import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { decodeBinaryCode } from '@/lib/binaryCode';

export async function GET(request, { params }) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const practicalId = parseInt(id);

    const submissions = await sql`
      SELECT s.id, s.language, s.status, s.raw_marks, s.normalized_marks, s.submitted_at, s.code
      FROM practical_submissions s
      WHERE s.student_id = ${user.id} AND s.practical_id = ${practicalId}
      ORDER BY s.submitted_at DESC
    `;

    const decodedSubmissions = submissions.map(s => ({
      ...s,
      code: decodeBinaryCode(s.code)
    }));

    return NextResponse.json(decodedSubmissions);
  } catch (error) {
    console.error('Error fetching submissions for practical:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
