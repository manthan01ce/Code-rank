/**
 * src/lib/execution/index.js — Language execution router
 *
 * Routes { language, code, input } to the correct runner function.
 */

import { Executor } from './Executor.js';

/** Set of language keys accepted by /api/execute */
export const ALLOWED_LANGUAGES = new Set(['python', 'cpp', 'c', 'java', 'javascript']);

/**
 * Route execution to the correct language runner.
 *
 * @param {string} language  — one of ALLOWED_LANGUAGES
 * @param {string} code      — source code string
 * @param {string} [input]   — optional stdin
 * @returns {Promise<{ success: boolean, stdout: string, stderr: string, exitCode: number }>}
 */
export async function executeCode(language, code, input = '') {
  if (!ALLOWED_LANGUAGES.has(language)) {
    return {
      success:  false,
      stdout:   '',
      stderr:   `Unsupported language: "${language}". Allowed: ${[...ALLOWED_LANGUAGES].join(', ')}`,
      exitCode: 400,
    };
  }

  const executor = new Executor(language, code);
  const compileRes = await executor.compile();

  if (!compileRes.success) {
    return {
      success: false,
      stdout: '',
      stderr: compileRes.error,
      exitCode: 1
    };
  }

  const res = await executor.runOneTestCase(input, '', 'playground', 0);

  return {
    success: !res.errorMessage,
    stdout: res.actualOutput,
    stderr: res.errorMessage,
    exitCode: res.errorMessage ? 1 : 0
  };
}
