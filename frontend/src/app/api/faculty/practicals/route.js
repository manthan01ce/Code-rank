import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { io as socketClient } from 'socket.io-client';

export async function GET(request) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'faculty') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('course_id');

    let practicals;
    if (courseId) {
      practicals = await sql`
        SELECT p.*, c.name as course_name, c.course_code,
               (SELECT COUNT(*)::int FROM practical_test_cases tc WHERE tc.practical_id = p.id) as test_cases_count,
               (SELECT COUNT(*)::int FROM practical_submissions s WHERE s.practical_id = p.id) as submissions_count
        FROM practicals p
        JOIN courses c ON p.course_id = c.id
        JOIN course_faculty cf ON cf.course_id = c.id
        WHERE cf.faculty_id = ${user.id}
          AND p.course_id = ${parseInt(courseId)}
        ORDER BY p.created_at DESC
      `;
    } else {
      practicals = await sql`
        SELECT p.*, c.name as course_name, c.course_code,
               (SELECT COUNT(*)::int FROM practical_test_cases tc WHERE tc.practical_id = p.id) as test_cases_count,
               (SELECT COUNT(*)::int FROM practical_submissions s WHERE s.practical_id = p.id) as submissions_count
        FROM practicals p
        JOIN courses c ON p.course_id = c.id
        JOIN course_faculty cf ON cf.course_id = c.id
        WHERE cf.faculty_id = ${user.id}
        ORDER BY p.created_at DESC
      `;
    }

    return NextResponse.json(practicals);
  } catch (error) {
    console.error('Fetch practicals error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'faculty') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      course_id,
      title,
      description,
      instructions = '',
      difficulty = 'Easy',
      is_challenge = false,
      starter_code = {},
      input_format = '',
      output_format = '',
      constraints = '',
      sample_input = '',
      sample_output = '',
      start_time = null,
      end_time = null,
      test_cases = []
    } = body;

    const batch_id = 'All';

    // Validate required fields
    if (!course_id || !title || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify co-coordinator mapping
    const mapping = await sql`
      SELECT is_co_coordinator FROM course_faculty 
      WHERE course_id = ${parseInt(course_id)} AND faculty_id = ${user.id}
    `;
    if (mapping.length === 0) {
      return NextResponse.json({ error: 'You are not assigned to this course.' }, { status: 403 });
    }
    if (!mapping[0].is_co_coordinator) {
      return NextResponse.json({ error: 'Forbidden: Only the subject co-coordinator can create practicals.' }, { status: 403 });
    }

    // Validate test cases
    if (!Array.isArray(test_cases) || test_cases.length === 0) {
      return NextResponse.json({ error: 'At least 1 test case is required.' }, { status: 400 });
    }
    if (test_cases.length > 20) {
      return NextResponse.json({ error: 'Maximum 20 test cases allowed per practical.' }, { status: 400 });
    }

    // Compute total marks
    let totalMarks = 0;
    for (const tc of test_cases) {
      const marksVal = parseFloat(tc.marks);
      if (isNaN(marksVal) || marksVal < 0) {
        return NextResponse.json({ error: 'Test case marks must be greater than or equal to 0.' }, { status: 400 });
      }
      totalMarks += marksVal;
    }

    // Insert practical
    const pResult = await sql`
      INSERT INTO practicals (
        faculty_id, course_id, batch_id, title, description, instructions, 
        total_marks, difficulty, is_challenge, starter_code, 
        input_format, output_format, constraints, sample_input, sample_output, status,
        start_time, end_time
      )
      VALUES (
        ${user.id}, ${parseInt(course_id)}, ${batch_id}, ${title}, ${description}, ${instructions},
        ${totalMarks}, ${difficulty}, ${is_challenge}, ${JSON.stringify(starter_code)},
        ${input_format}, ${output_format}, ${constraints}, ${sample_input}, ${sample_output}, 'active',
        ${start_time ? new Date(start_time) : null}, ${end_time ? new Date(end_time) : null}
      )
      RETURNING *
    `;

    const practicalId = pResult[0].id;

    // Insert test cases
    for (let i = 0; i < test_cases.length; i++) {
      const tc = test_cases[i];
      await sql`
        INSERT INTO practical_test_cases (
          practical_id, input, expected, marks, is_hidden, time_limit, memory_limit, order_index, label
        )
        VALUES (
          ${practicalId}, ${tc.input}, ${tc.expected}, ${parseFloat(tc.marks)}, 
          ${!!tc.is_hidden}, ${tc.time_limit ? parseFloat(tc.time_limit) : null}, 
          ${tc.memory_limit ? parseFloat(tc.memory_limit) : null}, ${i}, ${tc.label || `Test Case ${i + 1}`}
        )
      `;
    }

    await sql`
      INSERT INTO activity_logs (user_id, action, details)
      VALUES (${user.id}, 'CREATE_PRACTICAL', ${`Created practical "${title}" for course ${course_id}, batch ${batch_id}`})
    `;

    if (global.io) {
      global.io.to(`course_${course_id}`).emit('practical_added', pResult[0]);
      global.io.emit('practical_added', pResult[0]);
    } else {
      try {
        const socket = socketClient(`http://127.0.0.1:${process.env.PORT || 3000}`);
        socket.emit('faculty_practical_added', { course_id, practical: pResult[0] });
        setTimeout(() => socket.disconnect(), 1000);
      } catch (sockErr) {
        console.warn('Socket relay error:', sockErr);
      }
    }

    return NextResponse.json({ success: true, practical: pResult[0] });
  } catch (error) {
    console.error('Create practical error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}
