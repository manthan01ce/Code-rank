import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { runStdinStdout } from '@/lib/execution/runStdinStdout';

export async function POST(request, { params }) {
  try {
    // 1. Auth check
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const practicalId = parseInt(id);

    // 2. Parse body
    const { code, language } = await request.json();
    if (!code || !language) {
      return NextResponse.json({ error: 'Code and language are required' }, { status: 400 });
    }

    // 3. Fetch practical and check eligibility (batch & semester)
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

    // Fetch student profile details
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

    // 4. Fetch test cases (max 20)
    const testCases = await sql`
      SELECT * FROM practical_test_cases 
      WHERE practical_id = ${practicalId} 
      ORDER BY order_index ASC
    `;

    if (testCases.length === 0) {
      return NextResponse.json({ error: 'This practical has no test cases configured.' }, { status: 400 });
    }

    // 5. Run execution test case by test case using stdin/stdout
    let rawMarks = 0;
    let totalTime = 0;
    const submissionCasesToInsert = [];
    let compileErrorData = null;
    let isCompileError = false;

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      
      const result = await runStdinStdout({
        language: language.toLowerCase(),
        code,
        input: tc.input
      });

      if (result.status === 'compile_error') {
        isCompileError = true;
        compileErrorData = result.compileError;
        break;
      }

      const passed = result.success && (result.stdout.trim() === tc.expected.trim());
      const marksAwarded = passed ? parseFloat(tc.marks) : 0;
      rawMarks += marksAwarded;
      totalTime += result.runtimeMs || 0;

      submissionCasesToInsert.push({
        test_case_id: tc.id,
        passed,
        marks_awarded: marksAwarded,
        actual_output: result.stdout || '',
        error_message: result.stderr || (result.success ? '' : result.status || 'Execution failed'),
        execution_time_ms: result.runtimeMs || 0
      });
    }

    if (isCompileError) {
      const savedSub = await sql`
        INSERT INTO practical_submissions (
          student_id, practical_id, code, language, status, raw_marks, normalized_marks
        )
        VALUES (
          ${user.id}, ${practicalId}, ${code}, ${language}, 'Compile Error', 0, 0
        )
        RETURNING *
      `;
      return NextResponse.json({
        success: false,
        status: 'compile_error',
        summary: 'Compile Error',
        compileError: compileErrorData || 'Compilation failed',
        submissionId: savedSub[0].id
      });
    }

    // Normalization to 10 marks
    const totalPracticalMarks = parseFloat(practical.total_marks) || 1;
    const normalizedMarks = Math.min(10, Math.round(((rawMarks / totalPracticalMarks) * 10) * 100) / 100);

    const overallStatus = rawMarks === totalPracticalMarks ? 'Accepted' : 'Wrong Answer';

    // Save submission
    const savedSub = await sql`
      INSERT INTO practical_submissions (
        student_id, practical_id, code, language, status, raw_marks, normalized_marks, execution_time_ms
      )
      VALUES (
        ${user.id}, ${practicalId}, ${code}, ${language}, ${overallStatus}, ${rawMarks}, ${normalizedMarks}, ${totalTime}
      )
      RETURNING *
    `;

    const submissionId = savedSub[0].id;

    // Save case by case details
    for (const sc of submissionCasesToInsert) {
      await sql`
        INSERT INTO practical_submission_cases (
          submission_id, test_case_id, passed, marks_awarded, actual_output, error_message, execution_time_ms
        )
        VALUES (
          ${submissionId}, ${sc.test_case_id}, ${sc.passed}, ${sc.marks_awarded}, ${sc.actual_output}, ${sc.error_message}, ${sc.execution_time_ms}
        )
      `;
    }

    return NextResponse.json({
      success: true,
      status: overallStatus,
      raw_marks: rawMarks,
      normalized_marks: normalizedMarks,
      total_marks: totalPracticalMarks,
      submissionId
    });

  } catch (error) {
    console.error('Submit practical error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}
