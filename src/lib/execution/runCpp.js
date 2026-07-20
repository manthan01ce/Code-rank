/**
 * runCpp — C++17 runner  [STUB — Phase 2]
 *
 * Docker image:  gcc:13
 * Compile step:  g++ -std=c++17 -O2 -o solution temp.cpp
 * Run step:      ./solution < input.txt
 *
 * Implementation pattern: follow runPython.js exactly.
 * Two-stage execution needed:
 *   1. Run `docker run ... gcc:13 g++ -std=c++17 -O2 -o solution temp.cpp`
 *   2. If compile succeeds (exit 0), run `docker run ... ./solution < input.txt`
 *      (or do both inside a single sh -c command)
 *
 * Pull image before implementing:
 *   docker pull gcc:13
 *
 * @param {string} code
 * @param {string} [customInput]
 * @returns {Promise<{ success: boolean, stdout: string, stderr: string, exitCode: number }>}
 */
export async function runCpp(code, customInput = '') {
  // TODO Phase 2
  throw new Error(
    'C++ execution is not yet implemented. ' +
    'Pull image with: docker pull gcc:13, then implement following runPython.js pattern.'
  );
}
