import { Executor } from './Executor.js';

export async function runC(payload) {
  const executor = new Executor('c', payload.code);
  const compileRes = await executor.compile();

  if (!compileRes.success) {
    return {
      status: 'compile_error',
      summary: 'Compile Error',
      compileError: compileRes.error,
      cases: []
    };
  }

  const cases = await executor.runBatch(payload.testCases || []);
  const allPassed = cases.every(c => c.passed);

  return {
    status: allPassed ? 'accepted' : 'wrong_answer',
    summary: allPassed ? 'Accepted' : 'Wrong Answer',
    cases
  };
}
