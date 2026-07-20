/**
 * src/lib/execution/index.js — Language execution router
 *
 * Routes { language, code, input } to the correct runner function.
 * Phase 1: Only Python is fully implemented; all other runners throw.
 * Phase 2: Implement one language at a time starting with JavaScript.
 */

import { runPython }     from './runPython.js';
import { runCpp }        from './runCpp.js';
import { runJava }       from './runJava.js';
import { runJavaScript } from './runJavaScript.js';
import { runGo }         from './runGo.js';

/** Set of language keys accepted by /api/execute */
export const ALLOWED_LANGUAGES = new Set(['python', 'cpp', 'java', 'javascript', 'go']);

const RUNNERS = {
  python:     runPython,
  cpp:        runCpp,
  java:       runJava,
  javascript: runJavaScript,
  go:         runGo,
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

  return RUNNERS[language](code, input);
}
