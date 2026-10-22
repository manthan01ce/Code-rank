import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { authenticateRequest } from '@coderank/core/security/active-actor';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    if (!user || user.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch student's full profile to check batch & semester
        // Fetch student's full profile to check batch & semester & session
    const students = await sql`
      SELECT extra_info, session_token FROM users WHERE id = ${user.id}
    `;
    if (students.length === 0) {
      return NextResponse.json({ error: 'Student profile not found' }, { status: 404 });
    }
    if (user.id !== 0 && students[0].session_token && students[0].session_token !== user.session_token) {
        return NextResponse.json({ error: 'Logged in from another device' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('course_id');

    const extra = students[0].extra_info || {};
    const batch = (extra.batch || '').trim();
    const division = (extra.division || '').trim();
    const semester = parseInt(extra.semester) || 0;

    if (!semester) {
      return NextResponse.json([]);
    }

    // Fetch practicals where practical batch matches (by batch or division or all) and course semester matches student semester.
    const params = [user.id, batch, division, semester];
    let query = `
      SELECT p.id, p.course_id, p.batch_id, p.title, p.description, p.instructions, p.total_marks, p.difficulty, 
             p.is_challenge, p.input_format, p.output_format, p.constraints, 
             p.sample_input, p.sample_output, p.starter_code, p.start_time, p.end_time,
             c.name as course_name, c.course_code, c.semester as course_semester, u.name as faculty_name,
             s.status as my_status, s.normalized_marks as my_marks, s.submitted_at as my_submitted_at
      FROM practicals p
      JOIN courses c ON p.course_id = c.id
      JOIN users u ON p.faculty_id = u.id
      LEFT JOIN (
        SELECT DISTINCT ON (practical_id) 
          practical_id, status, normalized_marks, submitted_at
        FROM practical_submissions 
        WHERE student_id = $1
        ORDER BY practical_id, normalized_marks DESC, submitted_at DESC
      ) s ON s.practical_id = p.id
      WHERE (
        p.batch_id IS NULL 
        OR p.batch_id = '' 
        OR p.batch_id ILIKE 'all' 
        OR ($2 != '' AND p.batch_id ILIKE $2)
        OR ($3 != '' AND p.batch_id ILIKE $3)
      )
        AND c.semester = $4
        AND p.status = 'active'
    `;

    if (courseId) {
      if (!isNaN(parseInt(courseId))) {
        params.push(parseInt(courseId), courseId);
        query += ` AND (p.course_id = $${params.length - 1} OR c.course_code = $${params.length})`;
      } else {
        params.push(courseId);
        query += ` AND c.course_code = $${params.length}`;
      }
    }

    query += ' ORDER BY p.created_at DESC';

    const practicals = await sql.query(query, params);

    return NextResponse.json(practicals);
  } catch (error) {
    if (error.status) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Fetch student practicals error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
