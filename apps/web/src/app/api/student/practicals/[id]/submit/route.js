import { NextResponse } from 'next/server';
import sql from '@coderank/core/db';
import { getUserFromRequest } from '@coderank/core/utils/auth';
import { SubmissionService } from '@coderank/core/services/SubmissionService';

export async function POST(request, { params }) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const practicalId = parseInt(id);

    const { code, language } = await request.json();
    if (!code || !language) {
      return NextResponse.json({ error: 'Code and language are required' }, { status: 400 });
    }

    const practicals = await sql`
      SELECT p.*, c.semester 
      FROM practicals p
      JOIN courses c ON p.course_id = c.id
      WHERE p.id = ${practicalId} AND p.status = 'active'
    `;

    if (practicals.length === 0) {
      return NextResponse.json({ error: 'Practical not found or inactive' }, { status: 404 });
    }

    const practical = practicals[0];

    if (practical.start_time && new Date() < new Date(practical.start_time)) {
      return NextResponse.json({ error: 'This practical has not started yet.' }, { status: 403 });
    }

    const students = await sql`
      SELECT extra_info FROM users WHERE id = ${user.id}
    `;
    if (students.length === 0) {
      return NextResponse.json({ error: 'Student profile not found' }, { status: 404 });
    }

    const studentExtra = students[0].extra_info || {};
    if (practical.batch_id !== 'All' && studentExtra.batch !== practical.batch_id || parseInt(studentExtra.semester) !== practical.semester) {
      return NextResponse.json({ error: 'Access denied: This practical is not assigned to your batch/semester' }, { status: 403 });
    }

    try {
      const jobId = await SubmissionService.enqueueJob('dynamic', {
        language,
        code,
        dbId: practicalId,
        userId: user.id,
        isSubmit: true
      }, user.id);

      return NextResponse.json({
        success: true,
        jobId,
        status: 'queued',
        message: 'Submission enqueued for execution'
      }, { status: 202 });
    } catch (err) {
      if (err.message === 'QUEUE_FULL') {
        return NextResponse.json({ error: 'Execution queue is full. Please retry shortly.' }, { status: 503 });
      }
      throw err;
    }

  } catch (error) {
    console.error('Submit practical error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}
