import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

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

    // Authorization: if faculty, verify they own the practical. If student, verify they own the submission.
    if (user.role === 'faculty' && submission.faculty_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role === 'student' && submission.student_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch submission cases joined with test cases to get inputs/expected/hidden flags
    const cases = await sql`
      SELECT sc.*, tc.input, tc.expected, tc.is_hidden, tc.label
      FROM practical_submission_cases sc
      JOIN practical_test_cases tc ON sc.test_case_id = tc.id
      WHERE sc.submission_id = ${parseInt(id)}
      ORDER BY tc.order_index ASC
    `;

    // Filter hidden test case input/output for students
    const parsedCases = cases.map(c => {
      if (user.role === 'student' && c.is_hidden) {
        return {
          id: c.id,
          submission_id: c.submission_id,
          test_case_id: c.test_case_id,
          passed: c.passed,
          marks_awarded: c.marks_awarded,
          is_hidden: true,
          label: c.label,
          actual_output: '[Hidden Test Case Output]',
          input: '[Hidden]',
          expected: '[Hidden]'
        };
      }
      return c;
    });

    return NextResponse.json({
      ...submission,
      cases: parsedCases
    });
  } catch (error) {
    console.error('Fetch submission detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
