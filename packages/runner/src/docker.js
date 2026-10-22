import { execFile } from 'node:child_process';
// Feed scripts over stdin: large code/input must not exceed OS argument limits.
export function dockerCommand(args, { input = '', timeout = 12000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile('docker', args, { timeout, killSignal: 'SIGKILL', maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) { error.stdout = stdout; error.stderr = stderr; reject(error); }
      else resolve({ stdout, stderr, exitCode: 0 });
    });
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}
