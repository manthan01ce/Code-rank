import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request, { params }) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'faculty') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const courseId = parseInt(id);

    // 1. Get Course details and verify mapping
    const courseResult = await sql`
      SELECT c.* FROM courses c
      JOIN course_faculty cf ON c.id = cf.course_id
      WHERE c.id = ${courseId} AND cf.faculty_id = ${user.id}
    `;
    if (courseResult.length === 0) {
      return NextResponse.json({ error: 'Course not found or not allocated to you' }, { status: 404 });
    }
    const course = courseResult[0];

    // 2. Fetch all practicals for this course
    const practicals = await sql`
      SELECT id, title, total_marks 
      FROM practicals 
      WHERE course_id = ${courseId} AND status = 'active'
      ORDER BY created_at ASC
    `;

    // 3. Fetch all students in this course's semester
    const students = await sql`
      SELECT id, name, email, 
             extra_info->>'roll_number' as roll_number,
             extra_info->>'batch' as batch,
             extra_info->>'department' as department,
             extra_info->>'division' as division
      FROM users 
      WHERE role = 'student' 
        AND (extra_info->>'semester')::int = ${parseInt(course.semester)}
      ORDER BY extra_info->>'roll_number' ASC, name ASC
    `;

    // 4. Fetch highest scoring submissions per student per practical
    let submissions = [];
    if (practicals.length > 0) {
      submissions = await sql`
        SELECT DISTINCT ON (student_id, practical_id) 
          student_id, practical_id, normalized_marks, is_late, submitted_at
        FROM practical_submissions
        WHERE practical_id = ANY(${practicals.map(p => p.id)})
        ORDER BY student_id, practical_id, submitted_at DESC
      `;
    }

    return NextResponse.json({
      course,
      practicals,
      students,
      submissions
    });
  } catch (error) {
    console.error('Fetch course stats error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}
