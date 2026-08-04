import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { executionQueue } from './executionQueue.js';

const execAsync = promisify(exec);

export async function executePythonCode(code, customInput = '') {
  return executionQueue.run(async () => {
    const uuid = crypto.randomUUID();
    const tmpBase   = path.join(process.cwd(), '.tmp');
    const sessionDir = path.join(tmpBase, uuid);

  try {
    // ── 1. Create isolated temp directory ─────────────────────────────────
    await fs.mkdir(sessionDir, { recursive: true });

    // ── 2. Write temp.py and input.txt ────────────────────────────────────
    const tempPyPath    = path.join(sessionDir, 'temp.py');
    const inputTxtPath  = path.join(sessionDir, 'input.txt');

    await fs.writeFile(tempPyPath,   code,        'utf-8');
    await fs.writeFile(inputTxtPath, customInput, 'utf-8');

    console.log(`[DockerExec] Wrote temp.py (${code.length} chars) and input.txt to ${sessionDir}`);

    // ── 3. Build Docker command ───────────────────────────────────────────
    // Windows: replace backslashes for Docker Desktop volume mount
    const volumePath    = sessionDir.replace(/\\/g, '/');
    const containerName = `coderank_py_exec_${uuid.slice(0, 8)}`;

    // We use `sh -c` so we can pipe stdin from input.txt using redirection.
    // Exit code from python is propagated through sh correctly.
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

    console.log(`[DockerExec] Running: ${dockerCmd}`);

    // ── 4. Execute with hard timeout ──────────────────────────────────────
    try {
      const { stdout, stderr } = await execAsync(dockerCmd, {
        timeout: 10000,   // 10-second wall-clock limit
        killSignal: 'SIGKILL',
        maxBuffer: 1024 * 1024, // 1MB output buffer
      });

      console.log(`[DockerExec] ✅ Success — stdout: ${stdout.slice(0, 80)}`);

      return {
        success: true,
        stdout:   stdout  || '',
        stderr:   stderr  || '',
        exitCode: 0,
      };

    } catch (execError) {
      // child_process throws when the command exits with a non-zero code OR times out

      if (execError.killed) {
        // Timeout — clean up dangling container
        await execAsync(`docker rm -f ${containerName}`).catch(() => {});
        console.warn(`[DockerExec] ⏱ Timed out — container ${containerName} killed`);
        return {
          success:  false,
          stdout:   execError.stdout || '',
          stderr:   'Error: Execution timed out (exceeded 10 seconds). Check for infinite loops.',
          exitCode: 124,
        };
      }

      // Python runtime error (syntax error, exception, etc.) — exit code != 0
      const stderr = execError.stderr || execError.message || 'Unknown runtime error';
      console.warn(`[DockerExec] ❌ Runtime error — exit code: ${execError.code}\n${stderr.slice(0, 200)}`);

      return {
        success:  false,
        stdout:   execError.stdout || '',
        stderr:   stderr,
        exitCode: typeof execError.code === 'number' ? execError.code : 1,
      };
    }

  } catch (sysErr) {
    // Filesystem / Docker spawn failure
    console.error('[DockerExec] 🔥 System error:', sysErr.message);
    return {
      success:  false,
      stdout:   '',
      stderr:   `Execution environment error: ${sysErr.message}`,
      exitCode: 500,
    };

    } finally {
      // ── 5. Unconditional cleanup ───────────────────────────────────────────
      try {
        await fs.rm(sessionDir, { recursive: true, force: true });
        console.log(`[DockerExec] 🧹 Cleaned up ${sessionDir}`);
      } catch (cleanupErr) {
        console.error(`[DockerExec] Failed to clean up ${sessionDir}:`, cleanupErr.message);
      }
    }
  });
}
