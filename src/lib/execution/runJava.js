/**
 * runJava — Java 21 runner  [STUB — Phase 2]
 *
 * Docker image:  openjdk:21-slim
 * Compile step:  javac Solution.java
 * Run step:      java -cp . Solution < input.txt
 *
 * Implementation note: the public class name MUST match the filename.
 * Wrap the user's code so the outer class is always named "Solution".
 *
 * Pull image before implementing:
 *   docker pull openjdk:21-slim
 *
 * @param {string} code
 * @param {string} [customInput]
 * @returns {Promise<{ success: boolean, stdout: string, stderr: string, exitCode: number }>}
 */
export async function runJava(code, customInput = '') {
  // TODO Phase 2
  throw new Error(
    'Java execution is not yet implemented. ' +
    'Pull image with: docker pull openjdk:21-slim, then implement following runPython.js pattern.'
  );
}
