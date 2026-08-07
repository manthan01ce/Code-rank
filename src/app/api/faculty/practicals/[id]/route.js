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

    const practicals = await sql`
      SELECT * FROM practicals WHERE id = ${parseInt(id)} AND faculty_id = ${user.id}
    `;

    if (practicals.length === 0) {
      return NextResponse.json({ error: 'Practical not found' }, { status: 404 });
    }

    const testCases = await sql`
      SELECT * FROM practical_test_cases WHERE practical_id = ${parseInt(id)} ORDER BY order_index ASC
    `;

    return NextResponse.json({
      ...practicals[0],
      test_cases: testCases
    });
  } catch (error) {
    console.error('Fetch practical detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'faculty') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const {
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

    // Check practical
    const practicals = await sql`
      SELECT * FROM practicals WHERE id = ${parseInt(id)}
    `;
    if (practicals.length === 0) {
      return NextResponse.json({ error: 'Practical not found' }, { status: 404 });
    }

    // Verify co-coordinator mapping
    const mapping = await sql`
      SELECT is_co_coordinator FROM course_faculty 
      WHERE course_id = ${practicals[0].course_id} AND faculty_id = ${user.id}
    `;
    if (mapping.length === 0 || !mapping[0].is_co_coordinator) {
      return NextResponse.json({ error: 'Forbidden: Only the subject co-coordinator can modify practicals.' }, { status: 403 });
    }

    // Check if student submissions exist
    const submissions = await sql`
      SELECT COUNT(*)::int as count FROM practical_submissions WHERE practical_id = ${parseInt(id)}
    `;
    const submissionsCount = submissions[0].count;

    // Handle test case updates if provided
    let totalMarks = practicals[0].total_marks;
    const isUpdatingTestCases = Array.isArray(test_cases) && test_cases.length > 0;

    if (isUpdatingTestCases) {
      if (submissionsCount > 0) {
        return NextResponse.json({ 
          error: 'Editing test cases is disabled because students have already submitted.' 
        }, { status: 400 });
      }

      if (test_cases.length > 20) {
        return NextResponse.json({ error: 'Maximum 20 test cases allowed per practical.' }, { status: 400 });
      }

      // Compute total marks for test cases
      let computedTotal = 0;
      for (const tc of test_cases) {
        const mVal = parseFloat(tc.marks);
        if (isNaN(mVal) || mVal < 0) {
          return NextResponse.json({ error: 'Test case marks must be greater than or equal to 0.' }, { status: 400 });
        }
        computedTotal += mVal;
      }
      totalMarks = computedTotal;
    }

    // Update practical details
    const updated = await sql`
      UPDATE practicals
      SET title = ${title},
          description = ${description},
          instructions = ${instructions},
          difficulty = ${difficulty},
          is_challenge = ${is_challenge},
          starter_code = ${JSON.stringify(starter_code)},
          input_format = ${input_format},
          output_format = ${output_format},
          constraints = ${constraints},
          sample_input = ${sample_input},
          sample_output = ${sample_output},
          total_marks = ${totalMarks},
          start_time = ${start_time ? new Date(start_time) : null},
          end_time = ${end_time ? new Date(end_time) : null}
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    // Recreate test cases if they were updated and allowed
    if (isUpdatingTestCases && submissionsCount === 0) {
      await sql`DELETE FROM practical_test_cases WHERE practical_id = ${parseInt(id)}`;

      for (let i = 0; i < test_cases.length; i++) {
        const tc = test_cases[i];
        await sql`
          INSERT INTO practical_test_cases (
            practical_id, input, expected, marks, is_hidden, time_limit, memory_limit, order_index, label
          )
          VALUES (
            ${parseInt(id)}, ${tc.input}, ${tc.expected}, ${parseFloat(tc.marks)}, 
            ${!!tc.is_hidden}, ${tc.time_limit ? parseFloat(tc.time_limit) : null}, 
            ${tc.memory_limit ? parseFloat(tc.memory_limit) : null}, ${i}, ${tc.label || `Test Case ${i + 1}`}
          )
        `;
      }
    }

    await sql`
      INSERT INTO activity_logs (user_id, action, details)
      VALUES (${user.id}, 'UPDATE_PRACTICAL', ${`Updated practical "${title}" (ID: ${id})`})
    `;

    return NextResponse.json({ success: true, practical: updated[0] });
  } catch (error) {
    console.error('Update practical error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'faculty') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check practical
    const practicals = await sql`
      SELECT * FROM practicals WHERE id = ${parseInt(id)}
    `;
    if (practicals.length === 0) {
      return NextResponse.json({ error: 'Practical not found' }, { status: 404 });
    }

    // Verify co-coordinator mapping
    const mapping = await sql`
      SELECT is_co_coordinator FROM course_faculty 
      WHERE course_id = ${practicals[0].course_id} AND faculty_id = ${user.id}
    `;
    if (mapping.length === 0 || !mapping[0].is_co_coordinator) {
      return NextResponse.json({ error: 'Forbidden: Only the subject co-coordinator can delete practicals.' }, { status: 403 });
    }

    // Check if student submissions exist
    const submissions = await sql`
      SELECT COUNT(*)::int as count FROM practical_submissions WHERE practical_id = ${parseInt(id)}
    `;
    const submissionsCount = submissions[0].count;

    if (submissionsCount > 0) {
      // Soft delete: status = 'inactive'
      await sql`
        UPDATE practicals SET status = 'inactive' WHERE id = ${parseInt(id)}
      `;
      await sql`
        INSERT INTO activity_logs (user_id, action, details)
        VALUES (${user.id}, 'SOFT_DELETE_PRACTICAL', ${`Marked practical "${practicals[0].title}" (ID: ${id}) as inactive`})
      `;
      return NextResponse.json({ success: true, message: 'Practical marked as inactive due to existing submissions.' });
    } else {
      // Hard delete
      await sql`
        DELETE FROM practicals WHERE id = ${parseInt(id)}
      `;
      await sql`
        INSERT INTO activity_logs (user_id, action, details)
        VALUES (${user.id}, 'DELETE_PRACTICAL', ${`Deleted practical "${practicals[0].title}" (ID: ${id})`})
      `;
      return NextResponse.json({ success: true, message: 'Practical deleted permanently.' });
    }
  } catch (error) {
    console.error('Delete practical error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
