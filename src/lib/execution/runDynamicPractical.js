import sql from '@/lib/db';
import { Executor } from './Executor';

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
            if (Array.isArray(parsed)) {
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
            // Not a JSON array, treat as raw string if sample_output exists
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
    let isCompileError = false;
    let compileErrorData = null;
    const casesReport = [];
    const submissionCasesToInsert = [];

    // 3. Compile code once using Executor
    const executor = new Executor(language.toLowerCase(), code);
    const compileResult = await executor.compile();

    if (!compileResult.success) {
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
        compileError: compileResult.error || 'Compilation failed',
        runtimeError: null,
        cases: []
      };
    }

    // 4. Run all test cases in batch
    const results = await executor.runBatch(testCases);

    for (let i = 0; i < results.length; i++) {
      const tc = testCases[i];
      const result = results[i];

      rawMarks += result.marksAwarded;
      totalTime += result.runtimeMs || 0;

      const caseStatus = result.passed ? 'passed' : 'wrong_answer';

      casesReport.push({
        index: i + 1,
        status: caseStatus,
        input: { args: [tc.input], kwargs: {} },
        expected: tc.expected,
        actual: result.actualOutput,
        stdout: result.actualOutput,
        stderr: result.errorMessage,
        runtimeMs: Math.round((result.runtimeMs || 0) * 100) / 100
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
      submissionId = savedSub[0].id;

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

    // ── Emit real-time Socket.IO event to the faculty room ──
    if (isSubmit && userId && global.io && submissionId) {
      try {
        const userRes = await sql`SELECT name, email FROM users WHERE id = ${userId}`;
        const studentName = userRes.length > 0 ? userRes[0].name : 'Unknown Student';

        global.io.to(`practical_${dbId}`).emit('new_submission', {
          id: submissionId,
          student_name: studentName,
          status: overallStatus,
          raw_marks: rawMarks,
          normalized_marks: normalizedMarks,
          language,
          submitted_at: new Date().toISOString()
        });

        if (practical && practical.course_id) {
          global.io.to(`course_${practical.course_id}`).emit('new_submission_marks', {
            id: submissionId,
            practical_id: dbId,
            student_id: userId,
            normalized_marks: normalizedMarks
          });
        }
      } catch (err) {
        console.error('Failed to emit socket event:', err);
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
    const errorMessage = error.message.includes('fetch failed') 
      ? 'Error connecting to database: TypeError: fetch failed (Check your Neon DATABASE_URL or internet connection)' 
      : error.message;

    return {
      status: 'runtime_error',
      summary: 'Execution Failure',
      exitCode: 500,
      compileError: null,
      runtimeError: errorMessage,
      cases: []
    };
  }
}
