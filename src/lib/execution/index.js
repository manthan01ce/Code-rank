/**
 * src/lib/execution/index.js — Language execution router
 *
 * Routes { language, code, input } to the correct runner function.
 */

import { runPython }     from './runPython.js';
import { runCpp }        from './runCpp.js';
import { runC }          from './runC.js';
import { runJava }       from './runJava.js';
import { runJavaScript } from './runJavaScript.js';

/** Set of language keys accepted by /api/execute */
export const ALLOWED_LANGUAGES = new Set(['python', 'cpp', 'c', 'java', 'javascript']);

export const RUNNERS = {
  python:     runPython,
  cpp:        runCpp,
  c:          runC,
  java:       runJava,
  javascript: runJavaScript,
};

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

  return RUNNERS[language]({ code });
}
