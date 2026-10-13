import sql from '@coderank/core/db';
import { Executor } from './Executor.js';

function encodeBinaryCode(text) {
  if (!text) return '';
  return Buffer.from(text).toString('base64');
}

export async function runDynamicPractical({ language, code, dbId, userId, isSubmit = false }) {
  try {
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

    if (practical.start_time && new Date() < new Date(practical.start_time)) {
      return {
        status: 'runtime_error',
        summary: `Practical has not started yet. Starts at ${new Date(practical.start_time).toLocaleString()}`,
        exitCode: 403,
        compileError: null,
        runtimeError: `This practical has not started yet. Scheduled start time: ${new Date(practical.start_time).toLocaleString()}`,
        cases: []
      };
    }

    const isLate = !!(practical.end_time && new Date() > new Date(practical.end_time));

    let testCases = [];
    if (isSubmit) {
      testCases = await sql`
        SELECT * FROM practical_test_cases 
        WHERE practical_id = ${dbId} 
        ORDER BY order_index ASC
      `;
    } else {
      try {
        if (practical.sample_input) {
          try {
            const parsed = JSON.parse(practical.sample_input);
            if (Array.isArray(parsed) && parsed.length > 0) {
              testCases = parsed.map((ex, i) => ({
                id: `sample_${i}`,
                input: ex.input || '',
                expected: ex.expected || ex.output || '',
                marks: 0,
                is_hidden: false,
                time_limit: 5.0,
                label: `Sample ${i + 1}`
              }));
            }
          } catch (e) {
            if (practical.sample_output) {
              testCases = [{
                id: 'sample_0',
                input: practical.sample_input.trim(),
                expected: practical.sample_output.trim(),
                marks: 0,
                is_hidden: false,
                time_limit: 5.0,
                label: 'Sample 1'
              }];
            }
          }
        }
      } catch (e) {
        console.warn('Failed to parse sample input:', e);
      }

      if (testCases.length === 0) {
        const dbCases = await sql`
          SELECT * FROM practical_test_cases 
          WHERE practical_id = ${dbId} AND is_hidden = false 
          ORDER BY order_index ASC
        `;
        if (dbCases.length > 0) {
          testCases = dbCases;
        } else {
          const fallbackCases = await sql`
            SELECT * FROM practical_test_cases 
            WHERE practical_id = ${dbId} 
            ORDER BY order_index ASC 
            LIMIT 1
          `;
          if (fallbackCases.length > 0) {
            testCases = fallbackCases.map(c => ({ ...c, is_hidden: false }));
          }
        }
      }
    }

    if (testCases.length === 0) {
      return {
        status: 'runtime_error',
        summary: isSubmit ? 'No test cases configured' : 'No sample test cases configured',
        exitCode: 400,
        compileError: null,
        runtimeError: isSubmit ? 'No test cases configured for this practical' : 'No sample test cases configured for this practical',
        cases: []
      };
    }

    let rawMarks = 0;
    let totalTime = 0;
    const casesReport = [];
    const submissionCasesToInsert = [];

    const executor = new Executor(language.toLowerCase(), code, 3000, userId);
    const compileResult = await executor.compile();

    if (!compileResult.success) {
      if (isSubmit && userId) {
        const binaryCode = encodeBinaryCode(code);
        const existing = await sql`
          SELECT id, normalized_marks FROM practical_submissions 
          WHERE student_id = ${userId} AND practical_id = ${dbId}
        `;
        if (existing.length === 0) {
          await sql`
            INSERT INTO practical_submissions (
              student_id, practical_id, code, language, status, raw_marks, normalized_marks, is_late
            )
            VALUES (
              ${userId}, ${dbId}, ${binaryCode}, ${language}, 'Compile Error', 0, 0, ${isLate}
            )
          `;
        }
      }
      return {
        status: 'compile_error',
        summary: 'Compile Error',
        exitCode: 1,
        compileError: compileResult.error || 'Compilation failed',
        runtimeError: null,
        cases: []
      };
    }

    const results = await executor.runBatch(testCases);

    for (let i = 0; i < results.length; i++) {
      const tc = testCases[i];
      const result = results[i];

      rawMarks += result.marksAwarded;
      totalTime += result.runtimeMs || 0;

      const caseStatus = result.passed ? 'passed' : 'wrong_answer';
      const roundedRuntime = Math.round((result.runtimeMs || 0) * 100) / 100;

      casesReport.push({
        index: i + 1,
        id: tc.id,
        label: tc.label || `Test Case ${i + 1}`,
        status: caseStatus,
        passed: result.passed,
        is_hidden: !!tc.is_hidden,
        hidden: !!tc.is_hidden,
        input: tc.input,
        expected: tc.expected,
        expected_output: tc.expected,
        actual: tc.is_hidden ? '[Hidden Test Case]' : result.actualOutput,
        actual_output: tc.is_hidden ? '[Hidden Test Case]' : result.actualOutput,
        stdout: tc.is_hidden ? '' : (result.actualOutput || ''),
        stderr: tc.is_hidden ? '' : (result.errorMessage || ''),
        error_message: tc.is_hidden ? (result.passed ? null : 'Hidden test case failed') : result.errorMessage,
        marks_awarded: result.marksAwarded,
        max_marks: tc.marks,
        runtimeMs: roundedRuntime,
        execution_time_ms: roundedRuntime
      });

      submissionCasesToInsert.push({
        test_case_id: tc.id,
        passed: result.passed,
        marks_awarded: result.marksAwarded,
        actual_output: result.actualOutput,
        error_message: result.errorMessage,
        execution_time_ms: result.runtimeMs || 0
      });
    }

    const totalPracticalMarks = parseFloat(practical.total_marks) || 1;
    const normalizedMarks = Math.min(10, Math.round(((rawMarks / totalPracticalMarks) * 10) * 100) / 100);
    const overallStatus = rawMarks === totalPracticalMarks ? 'Accepted' : 'Wrong Answer';

    let submissionId = null;
    let finalNormalizedMarks = normalizedMarks;
    let finalOverallStatus = overallStatus;
    let finalRawMarks = rawMarks;

    if (isSubmit && userId) {
      const existing = await sql`
        SELECT id, normalized_marks, raw_marks, status 
        FROM practical_submissions 
        WHERE student_id = ${userId} AND practical_id = ${dbId}
      `;

      const binaryCode = encodeBinaryCode(code);

      if (existing.length === 0) {
        const savedSub = await sql`
          INSERT INTO practical_submissions (
            student_id, practical_id, code, language, status, raw_marks, normalized_marks, execution_time_ms, is_late
          )
          VALUES (
            ${userId}, ${dbId}, ${binaryCode}, ${language}, ${overallStatus}, ${rawMarks}, ${normalizedMarks}, ${totalTime}, ${isLate}
          )
          RETURNING id
        `;
        submissionId = savedSub[0].id;

        if (submissionCasesToInsert.length > 0) {
          await sql`
            INSERT INTO practical_submission_cases (
              submission_id, test_case_id, passed, marks_awarded, actual_output, error_message, execution_time_ms
            )
            SELECT * FROM UNNEST(
              ${submissionCasesToInsert.map(s => submissionId)}::int[],
              ${submissionCasesToInsert.map(s => s.test_case_id)}::int[],
              ${submissionCasesToInsert.map(s => s.passed)}::boolean[],
              ${submissionCasesToInsert.map(s => s.marks_awarded)}::numeric[],
              ${submissionCasesToInsert.map(s => s.actual_output)}::text[],
              ${submissionCasesToInsert.map(s => s.error_message)}::text[],
              ${submissionCasesToInsert.map(s => s.execution_time_ms)}::numeric[]
            )
          `;
        }
      } else {
        submissionId = existing[0].id;
        const prevNormalized = parseFloat(existing[0].normalized_marks) || 0;

        if (normalizedMarks > prevNormalized) {
          await sql`
            UPDATE practical_submissions
            SET code = ${binaryCode},
                language = ${language},
                status = ${overallStatus},
                raw_marks = ${rawMarks},
                normalized_marks = ${normalizedMarks},
                execution_time_ms = ${totalTime},
                is_late = ${isLate},
                submitted_at = NOW()
            WHERE id = ${submissionId}
          `;

          await sql`DELETE FROM practical_submission_cases WHERE submission_id = ${submissionId}`;
          if (submissionCasesToInsert.length > 0) {
            await sql`
              INSERT INTO practical_submission_cases (
                submission_id, test_case_id, passed, marks_awarded, actual_output, error_message, execution_time_ms
              )
              SELECT * FROM UNNEST(
                ${submissionCasesToInsert.map(s => submissionId)}::int[],
                ${submissionCasesToInsert.map(s => s.test_case_id)}::int[],
                ${submissionCasesToInsert.map(s => s.passed)}::boolean[],
                ${submissionCasesToInsert.map(s => s.marks_awarded)}::numeric[],
                ${submissionCasesToInsert.map(s => s.actual_output)}::text[],
                ${submissionCasesToInsert.map(s => s.error_message)}::text[],
                ${submissionCasesToInsert.map(s => s.execution_time_ms)}::numeric[]
              )
            `;
          }
        } else {
          finalNormalizedMarks = prevNormalized;
          finalRawMarks = parseFloat(existing[0].raw_marks) || 0;
          finalOverallStatus = existing[0].status;
        }
      }
    }

    const allPassed = rawMarks === totalPracticalMarks;
    return {
      status: allPassed ? 'accepted' : 'wrong_answer',
      summary: allPassed ? 'All test cases passed' : `${casesReport.filter(c => c.status === 'passed').length} / ${testCases.length} cases passed`,
      exitCode: 0,
      compileError: null,
      runtimeError: null,
      cases: casesReport,
      submissionId,
      normalizedMarks: finalNormalizedMarks,
      rawMarks: finalRawMarks,
      overallStatus: finalOverallStatus
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
