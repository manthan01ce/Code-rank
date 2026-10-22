import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { authenticateRequest } from '@coderank/core/security/active-actor';

export async function GET(request, { params }) {
  try {
    const user = await authenticateRequest(request);
    if (!user || (user.role !== 'faculty' && user.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const practicalId = parseInt(id);

    // Admins can view any practical; faculty can only view practicals they own
    const practicals = user.role === 'admin'
      ? await sql`
          SELECT p.*, c.name as course_name, c.course_code, c.semester
          FROM practicals p
          JOIN courses c ON p.course_id = c.id
          WHERE p.id = ${practicalId}
        `
      : await sql`
          SELECT p.*, c.name as course_name, c.course_code, c.semester
          FROM practicals p
          JOIN courses c ON p.course_id = c.id
          WHERE p.id = ${practicalId} AND p.faculty_id = ${user.id}
        `;

    if (practicals.length === 0) {
      return NextResponse.json({ error: 'Practical not found or access denied' }, { status: 404 });
    }

    const practical = practicals[0];
    const { batch_id, course_id, semester } = practical;

    // 1. Stats
    const statsResult = await sql`
      SELECT 
        COALESCE(AVG(normalized_marks), 0)::float as avg_normalized,
        COUNT(*)::int as total_submissions,
        COUNT(DISTINCT student_id)::int as attempted_students
      FROM practical_submissions
      WHERE practical_id = ${practicalId}
    `;

    const stats = statsResult[0];

    // 2. Fetch all active students in the batch or semester
    let students;
    if (batch_id === 'All') {
      students = await sql`
        SELECT id, name, email, extra_info->>'roll_number' as roll_number
        FROM users
        WHERE role = 'student' AND status = 'active' AND (extra_info->>'semester')::int = ${semester}
        ORDER BY name ASC
      `;
    } else {
      students = await sql`
        SELECT id, name, email, extra_info->>'roll_number' as roll_number
        FROM users
        WHERE role = 'student' AND status = 'active' AND extra_info->>'batch' = ${batch_id}
        ORDER BY name ASC
      `;
    }

    // 3. Fetch submissions (get the highest score per student)
    const submissions = await sql`
      SELECT DISTINCT ON (student_id) 
        student_id, raw_marks, normalized_marks, submitted_at, status
      FROM practical_submissions
      WHERE practical_id = ${practicalId}
      ORDER BY student_id, normalized_marks DESC, submitted_at DESC
    `;

    // Map student details with submission details
    const studentGrades = students.map(s => {
      const sub = submissions.find(sub => sub.student_id === s.id);
      return {
        id: s.id,
        name: s.name,
        email: s.email,
        roll_number: s.roll_number || '—',
        attempted: !!sub,
        raw_marks: sub ? parseFloat(sub.raw_marks) : 0,
        normalized_marks: sub ? parseFloat(sub.normalized_marks) : 0,
        submitted_at: sub ? sub.submitted_at : null,
        status: sub ? sub.status : 'Not Attempted'
      };
    });

    return NextResponse.json({
      practical: {
        id: practical.id,
        title: practical.title,
        course_code: practical.course_code,
        course_name: practical.course_name,
        batch_id: practical.batch_id,
        total_marks: parseFloat(practical.total_marks)
      },
      stats: {
        average_marks: Math.round(stats.avg_normalized * 100) / 100,
        submissions_count: stats.total_submissions,
        attempted_count: stats.attempted_students,
        total_students: students.length
      },
      students: studentGrades
    });

  } catch (error) {
    if (error.status) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Fetch practical stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
