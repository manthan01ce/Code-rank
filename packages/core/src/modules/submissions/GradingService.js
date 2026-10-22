import sql from '../../db/client.js';
import { publicResult } from '../../security/execution.js';
import { saveAttempt, findAttempt } from './SubmissionRepository.js';

export async function gradePractical({ language, code, dbId, userId, isSubmit = false, jobId, enqueuedAt }, createExecutor) {
  let executor;
  const submittedAt = new Date(enqueuedAt || Date.now());
  if (isSubmit && (!jobId || !userId || !Number.isFinite(submittedAt.getTime()))) throw new Error("Submission job identity is required");
  try {
    if (isSubmit) {
      const prior = await findAttempt({ jobId, userId, dbId, code, language });
      if (prior) return prior;
    }
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

    const isLate = !!(practical.end_time && submittedAt > new Date(practical.end_time));

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
          // Hidden cases must never be used as public samples.

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

    executor = createExecutor(language.toLowerCase(), code, 3000, userId);
    const compileResult = await executor.compile();

    if (!compileResult.success) {
      const result = {
        status: 'compile_error',
        summary: 'Compile Error',
        exitCode: 1,
        compileError: compileResult.error || 'Compilation failed',
        runtimeError: null,
        cases: []
      };
      return isSubmit ? saveAttempt({ jobId, userId, dbId, code, language, status: 'Compile Error', rawMarks: 0, normalizedMarks: 0, totalTime: 0, isLate, submittedAt, cases: [], result }) : result;
    }

    const results = await executor.runBatch(testCases);

    for (let i = 0; i < results.length; i++) {
      const tc = testCases[i];
      const result = results[i];

      rawMarks += result.marksAwarded;
      totalTime += result.runtimeMs || 0;

      const caseStatus = result.passed ? 'passed' : result.exitCode === 124 ? 'time_limit_exceeded' : result.exitCode !== 0 ? 'runtime_error' : 'wrong_answer';
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
    const overallStatus = results.length === testCases.length && results.every(result => result.passed) ? 'Accepted' : 'Wrong Answer';

    const allPassed = results.length === testCases.length && results.every(result => result.passed);
    const result = {
      status: allPassed ? 'accepted' : 'wrong_answer',
      summary: allPassed ? 'All test cases passed' : `${casesReport.filter(c => c.status === 'passed').length} / ${testCases.length} cases passed`,
      exitCode: 0,
      compileError: null,
      runtimeError: null,
      cases: publicResult({ cases: casesReport }).cases,
      submissionId: null,
      normalizedMarks,
      rawMarks,
      overallStatus
    };

    return isSubmit ? saveAttempt({ jobId, userId, dbId, code, language, status: overallStatus, rawMarks, normalizedMarks, totalTime, isLate, submittedAt, cases: submissionCasesToInsert, result }) : result;

  } finally {
    if (executor) await executor.cleanup();
  }
}
