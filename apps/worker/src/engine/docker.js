import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const execAsync = promisify(exec);

export async function executePythonCode(code, customInput = '') {
  const uuid = crypto.randomUUID();
  const tmpBase = path.join(process.cwd(), '.tmp');
  const sessionDir = path.join(tmpBase, uuid);

  try {
    await fs.mkdir(sessionDir, { recursive: true });

    const tempPyPath = path.join(sessionDir, 'temp.py');
    const inputTxtPath = path.join(sessionDir, 'input.txt');

    await fs.writeFile(tempPyPath, code, 'utf-8');
    await fs.writeFile(inputTxtPath, customInput, 'utf-8');

    const volumePath = sessionDir.replace(/\\/g, '/');
    const containerName = `coderank_py_exec_${uuid.slice(0, 8)}`;

    const dockerCmd = [
      'docker run',
      '--rm',
      `--name ${containerName}`,
      '--memory=128m',
      '--cpus=0.5',
      '--network none',
      `--volume "${volumePath}:/app"`,
      '--workdir /app',
      'coderank-python:latest',
      'sh -c "python temp.py < input.txt"',
    ].join(' ');

    try {
      const { stdout, stderr } = await execAsync(dockerCmd, {
        timeout: 10000,
        killSignal: 'SIGKILL',
        maxBuffer: 1024 * 1024,
      });

      return {
        success: true,
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: 0,
      };
    } catch (execError) {
      if (execError.killed) {
        await execAsync(`docker rm -f ${containerName}`).catch(() => {});
        return {
          success: false,
          stdout: execError.stdout || '',
          stderr: 'Error: Execution timed out (exceeded 10 seconds). Check for infinite loops.',
          exitCode: 124,
        };
      }

      const stderr = execError.stderr || execError.message || 'Unknown runtime error';
      return {
        success: false,
        stdout: execError.stdout || '',
        stderr,
        exitCode: typeof execError.code === 'number' ? execError.code : 1,
      };
    }
  } catch (sysErr) {
    return {
      success: false,
      stdout: '',
      stderr: `Execution environment error: ${sysErr.message}`,
      exitCode: 500,
    };
  } finally {
    try {
      await fs.rm(sessionDir, { recursive: true, force: true });
    } catch {}
  }
}

export async function checkDockerHealth() {
  try {
    const { stdout } = await execAsync('docker info --format "{{.ServerVersion}}"');
    return { healthy: true, version: stdout.trim() };
  } catch (err) {
    return { healthy: false, error: err.message };
  }
}
