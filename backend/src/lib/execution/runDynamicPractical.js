import sql from '../db.js';
import { Executor } from './Executor.js';
import { encodeBinaryCode } from '../binaryCode.js';

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

    // Check timeline: start_time
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
      } catch (err) {
        console.warn('Failed to parse sample input:', err);
      }

      // Fallback: If no valid sample_input test cases, fetch non-hidden test cases from practical_test_cases table
      if (testCases.length === 0) {
        const dbCases = await sql`
          SELECT * FROM practical_test_cases 
          WHERE practical_id = ${dbId} AND is_hidden = false 
          ORDER BY order_index ASC
        `;
        if (dbCases.length > 0) {
          testCases = dbCases;
        } else {
          // If all test cases are marked hidden, take the first test case for sample running
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
        summary: isSubmit ? 'No test cases configured for this practical.' : 'No sample test cases provided for this practical.',
        exitCode: 400,
        compileError: null,
        runtimeError: isSubmit ? 'No test cases configured for this practical.' : 'No sample test cases provided for this practical.',
        cases: []
      };
    }

    let rawMarks = 0;
    let totalTime = 0;
    const casesReport = [];
    const submissionCasesToInsert = [];

    // 3. Compile code once using Executor
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

    // 4. Run all test cases in batch
    const results = await executor.runBatch(testCases);

    for (let i = 0; i < results.length; i++) {
      const tc = testCases[i];
      const result = results[i];

      rawMarks += result.marksAwarded;
      totalTime += (result.runtimeMs || 0);

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
        actual: result.actualOutput,
        actual_output: result.actualOutput,
        stdout: (result.actualOutput || ''),
        stderr: (result.errorMessage || ''),
        error_message: result.errorMessage,
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

    // 4. Save to Database if it is a Submit (Maintain only ONE submission per student with highest marks)
    if (isSubmit && userId) {
      const existing = await sql`
        SELECT id, normalized_marks, raw_marks, status 
        FROM practical_submissions 
        WHERE student_id = ${userId} AND practical_id = ${dbId}
      `;

      const binaryCode = encodeBinaryCode(code);

      if (existing.length === 0) {
        // First submission for this student
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
        // Existing submission found
        submissionId = existing[0].id;
        const prevNormalized = parseFloat(existing[0].normalized_marks) || 0;

        if (normalizedMarks > prevNormalized) {
          // Score improved! Update submission record and replace test case results
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
          // Lower or equal score: strictly preserve the highest marks!
          finalNormalizedMarks = prevNormalized;
          finalRawMarks = parseFloat(existing[0].raw_marks) || 0;
          finalOverallStatus = existing[0].status;
        }
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
          status: finalOverallStatus,
          raw_marks: finalRawMarks,
          normalized_marks: finalNormalizedMarks,
          language,
          submitted_at: new Date().toISOString()
        });

        if (practical && practical.course_id) {
          global.io.to(`course_${practical.course_id}`).emit('new_submission_marks', {
            id: submissionId,
            practical_id: dbId,
            student_id: userId,
            normalized_marks: finalNormalizedMarks
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
