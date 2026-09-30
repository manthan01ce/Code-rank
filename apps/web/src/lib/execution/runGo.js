/**
 * runGo — Go 1.22 runner  [STUB — Phase 2]
 *
 * Docker image:  golang:1.22-alpine
 * Compile step:  go build -o solution temp.go
 * Run step:      ./solution < input.txt
 *
 * Note: Alpine image keeps the download size small (~250 MB vs ~800 MB for debian).
 *
 * Pull image before implementing:
 *   docker pull golang:1.22-alpine
 *
 * @param {string} code
 * @param {string} [customInput]
 * @returns {Promise<{ success: boolean, stdout: string, stderr: string, exitCode: number }>}
 */
export async function runGo(code, customInput = '') {
  // TODO Phase 2
  throw new Error(
    'Go execution is not yet implemented. ' +
    'Pull image with: docker pull golang:1.22-alpine, then implement following runPython.js pattern.'
  );
}
