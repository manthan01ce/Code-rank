import sql from '@/lib/db';
import { runStdinStdout } from './runStdinStdout';

export async function runDynamicPractical({ language, code, dbId, userId, isSubmit = false }) {
  try {
    // 1. Fetch practical
    const practicals = await sql`
      SELECT p.*, c.semester 
      FROM practicals p
      JOIN courses c ON p.course_id = c.id
      WHERE p.id = ${dbId} AND p.status = 'active'
    `;

    if (practicals.length === 0) {
      return {
        status: 'runtime_error',
        summary: 'Practical not found or inactive',
        exitCode: 404,
        compileError: null,
        runtimeError: 'Practical not found or inactive',
        cases: []
      };
    }

    const practical = practicals[0];

    // 2. Fetch test cases
    const testCases = await sql`
      SELECT * FROM practical_test_cases 
      WHERE practical_id = ${dbId} 
      ORDER BY order_index ASC
    `;

    if (testCases.length === 0) {
      return {
        status: 'runtime_error',
        summary: 'No test cases configured',
        exitCode: 400,
        compileError: null,
        runtimeError: 'No test cases configured for this practical',
        cases: []
      };
    }

    let rawMarks = 0;
    let totalTime = 0;
    let isCompileError = false;
    let compileErrorData = null;
    const casesReport = [];
    const submissionCasesToInsert = [];

    // 3. Execute each case
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

      const trimmedActual = (result.stdout || '').trim();
      const trimmedExpected = (tc.expected || '').trim();
      const passed = result.success && (trimmedActual === trimmedExpected);
      const marksAwarded = passed ? parseFloat(tc.marks) : 0;
      rawMarks += marksAwarded;
      totalTime += result.runtimeMs || 0;

      const caseStatus = passed ? 'passed' : 'wrong_answer';

      casesReport.push({
        index: i + 1,
        status: caseStatus,
        input: { args: [tc.input], kwargs: {} },
        expected: tc.expected,
        actual: result.stdout || '',
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        runtimeMs: Math.round((result.runtimeMs || 0) * 100) / 100
      });

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
      if (isSubmit && userId) {
        await sql`
          INSERT INTO practical_submissions (
            student_id, practical_id, code, language, status, raw_marks, normalized_marks
          )
          VALUES (
            ${userId}, ${dbId}, ${code}, ${language}, 'Compile Error', 0, 0
          )
        `;
      }
      return {
        status: 'compile_error',
        summary: 'Compile Error',
        exitCode: 1,
        compileError: compileErrorData || 'Compilation failed',
        runtimeError: null,
        cases: []
      };
    }

    const totalPracticalMarks = parseFloat(practical.total_marks) || 1;
    const normalizedMarks = Math.min(10, Math.round(((rawMarks / totalPracticalMarks) * 10) * 100) / 100);
    const overallStatus = rawMarks === totalPracticalMarks ? 'Accepted' : 'Wrong Answer';

    // 4. Save to Database if it is a Submit
    if (isSubmit && userId) {
      const savedSub = await sql`
        INSERT INTO practical_submissions (
          student_id, practical_id, code, language, status, raw_marks, normalized_marks, execution_time_ms
        )
        VALUES (
          ${userId}, ${dbId}, ${code}, ${language}, ${overallStatus}, ${rawMarks}, ${normalizedMarks}, ${totalTime}
        )
        RETURNING id
      `;
      const submissionId = savedSub[0].id;

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
    }

    const allPassed = rawMarks === totalPracticalMarks;
    return {
      status: allPassed ? 'accepted' : 'wrong_answer',
      summary: allPassed ? 'All test cases passed' : `${casesReport.filter(c => c.status === 'passed').length} / ${testCases.length} cases passed`,
      exitCode: 0,
      compileError: null,
      runtimeError: null,
      cases: casesReport
    };

  } catch (error) {
    console.error('runDynamicPractical error:', error);
    return {
      status: 'runtime_error',
      summary: 'Execution Failure',
      exitCode: 500,
      compileError: null,
      runtimeError: error.message,
      cases: []
    };
  }
}
