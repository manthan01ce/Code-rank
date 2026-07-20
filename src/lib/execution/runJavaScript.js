/**
 * runJavaScript — Node.js 20 runner  [STUB — Phase 2, FIRST new language]
 *
 * Docker image:  node:20-slim
 * No compile step — run directly:
 *   node temp.js < input.txt
 *
 * Recommended as the FIRST new language to implement after Python because:
 *  - No separate compile step (unlike C++ and Java)
 *  - Follows the exact same pattern as runPython.js with minimal changes
 *
 * Pull image before implementing:
 *   docker pull node:20-slim
 *
 * @param {string} code
 * @param {string} [customInput]
 * @returns {Promise<{ success: boolean, stdout: string, stderr: string, exitCode: number }>}
 */
export async function runJavaScript(code, customInput = '') {
  // TODO Phase 2 — implement first, before C++ and Java
  throw new Error(
    'JavaScript execution is not yet implemented. ' +
    'Pull image with: docker pull node:20-slim, then implement following runPython.js pattern.'
  );
}
