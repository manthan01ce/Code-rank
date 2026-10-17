/**
 * apps/worker/src/execution/runners/javascript.js
 *
 * JavaScript runner for stdin/stdout practice problems.
 * Function-style (class-method) problems are not supported for JavaScript —
 * an explicit unsupported result is returned rather than silently grading
 * the wrong contract.
 */
import { Executor } from './Executor.js';

export async function runJavaScript(payload) {
  // Function-style problems have a problem.entry.type of 'class-method'.
  // JavaScript has no function harness; reject early with a clear message.
  if (payload.problem?.entry?.type === 'class-method') {
    return {
      status: 'unsupported',
      summary: 'Unsupported: JavaScript function-style practice is not yet implemented. Use stdin/stdout problems.',
      cases: [],
    };
  }

  const executor = new Executor('javascript', payload.code);
  const compileRes = await executor.compile();

  if (!compileRes.success) {
    await executor.cleanup();
    return {
      status: 'compile_error',
      summary: 'Compile Error',
      compileError: compileRes.error,
      cases: [],
    };
  }

  const cases = await executor.runBatch(payload.testCases || []);
  await executor.cleanup();
  const allPassed = cases.every(c => c.passed);

  return {
    status: allPassed ? 'accepted' : 'wrong_answer',
    summary: allPassed ? 'Accepted' : 'Wrong Answer',
    cases,
  };
}
