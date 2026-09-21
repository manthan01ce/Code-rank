import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { decodeBinaryCode } from '@/lib/binaryCode';

export async function GET(request, { params }) {
  try {
    const user = getUserFromRequest(request);
    if (!user || (user.role !== 'faculty' && user.role !== 'student')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Fetch submission
    const submissions = await sql`
      SELECT s.*, u.name as student_name, u.email as student_email,
             p.title as practical_title, p.total_marks as practical_total_marks, p.faculty_id
      FROM practical_submissions s
      JOIN users u ON s.student_id = u.id
      JOIN practicals p ON s.practical_id = p.id
      WHERE s.id = ${parseInt(id)}
    `;

    if (submissions.length === 0) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    const submission = submissions[0];

    // Authorization: if faculty, verify they are mapped to the course or created the practical. If student, verify they own the submission.
    if (user.role === 'faculty') {
      const mapping = await sql`
        SELECT 1 FROM course_faculty cf
        JOIN practicals p ON p.course_id = cf.course_id
        WHERE p.id = ${submission.practical_id} AND cf.faculty_id = ${user.id}
      `;
      if (mapping.length === 0 && Number(submission.faculty_id) !== Number(user.id)) {
        return NextResponse.json({ error: 'Unauthorized: You are not assigned to this course.' }, { status: 403 });
      }
    }
    if (user.role === 'student' && submission.student_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Fetch submission cases joined with test cases to get inputs/expected/hidden flags
    const cases = await sql`
      SELECT sc.*, tc.input, tc.expected, tc.is_hidden, tc.label
      FROM practical_submission_cases sc
      JOIN practical_test_cases tc ON sc.test_case_id = tc.id
      WHERE sc.submission_id = ${parseInt(id)}
      ORDER BY tc.order_index ASC
    `;

    // (Hidden test cases are now fully visible to students as requested)
    const parsedCases = cases;

    return NextResponse.json({
      ...submission,
      code: decodeBinaryCode(submission.code),
      cases: parsedCases
    });
  } catch (error) {
    console.error('Fetch submission detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'faculty') {
      return NextResponse.json({ error: 'Unauthorized: Only faculty can delete submissions.' }, { status: 401 });
    }

    const { id } = await params;
    const subId = parseInt(id);

    // Verify submission exists and faculty is assigned to the course or created the practical
    const submissions = await sql`
      SELECT s.*, p.title as practical_title, p.faculty_id
      FROM practical_submissions s
      JOIN practicals p ON s.practical_id = p.id
      WHERE s.id = ${subId}
    `;

    if (submissions.length === 0) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    const submission = submissions[0];

    const mapping = await sql`
      SELECT 1 FROM course_faculty cf
      JOIN practicals p ON p.course_id = cf.course_id
      WHERE p.id = ${submission.practical_id} AND cf.faculty_id = ${user.id}
    `;
    if (mapping.length === 0 && Number(submission.faculty_id) !== Number(user.id)) {
      return NextResponse.json({ error: 'Unauthorized: You are not assigned to this course.' }, { status: 403 });
    }

        const studentId = submission.student_id;
    const practicalId = submission.practical_id;

    // Delete all submission cases for this student/practical
    await sql`DELETE FROM practical_submission_cases WHERE submission_id IN (SELECT id FROM practical_submissions WHERE student_id = ${studentId} AND practical_id = ${practicalId})`;

    // Delete all submissions for this student/practical
    await sql`DELETE FROM practical_submissions WHERE student_id = ${studentId} AND practical_id = ${practicalId}`;

    // Delete workspace code so student can't see it again
    await sql`DELETE FROM student_workspaces WHERE student_id = ${studentId} AND practical_id = ${practicalId}`;

    // Audit log
    try {
      await sql`
        INSERT INTO activity_logs (user_id, action, details)
        VALUES (${user.id}, 'DELETE_SUBMISSION', ${JSON.stringify({
          submission_id: subId,
          student_id: submission.student_id,
          practical_id: submission.practical_id,
          practical_title: submission.practical_title
        })})
      `;
    } catch (logErr) {
      console.warn('Could not write activity log:', logErr);
    }

    return NextResponse.json({ success: true, message: 'Submission deleted successfully' });
  } catch (error) {
    console.error('Delete submission error:', error);
    return NextResponse.json({ error: 'Failed to delete submission' }, { status: 500 });
  }
}
