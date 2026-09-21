/**
 * PURPOSE OF THIS FILE:
 * API endpoint GET /api/student/submissions.
 * Authenticates the user token and queries the Postgres DB using Neon Serverless
 * to return all previous workspace programming submissions completed by the student.
 */
import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { decodeBinaryCode } from '@/lib/binaryCode';

export async function GET(request) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const submissions = await sql`
      SELECT 
        s.id, s.language, s.status, s.raw_marks, s.normalized_marks, s.submitted_at, s.code,
        p.title as practical_title
      FROM practical_submissions s
      JOIN practicals p ON s.practical_id = p.id
      WHERE s.student_id = ${user.id} AND p.status = 'active'
      ORDER BY s.submitted_at DESC
    `;

    const decodedSubmissions = submissions.map(s => ({
      ...s,
      code: decodeBinaryCode(s.code)
    }));

    return NextResponse.json(decodedSubmissions);
  } catch (error) {
    console.error('Error fetching student submissions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
