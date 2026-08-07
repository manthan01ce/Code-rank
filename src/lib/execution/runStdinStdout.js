import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { executionQueue } from '../executionQueue.js';

const execAsync = promisify(exec);

export async function runStdinStdout({ language, code, input, timeoutMs = 5000, memoryMb = 128 }) {
  return executionQueue.run(async () => {
    const uuid = crypto.randomUUID();
    const tmpBase = path.join(process.cwd(), '.tmp');
    const sessionDir = path.join(tmpBase, uuid);

    try {
      await fs.mkdir(sessionDir, { recursive: true });
      
      const volumePath = sessionDir.replace(/\\/g, '/');
      const containerName = `coderank_stdin_runner_${uuid.slice(0, 8)}`;
      let dockerCmd = '';

      if (language === 'python') {
        const pyFile = path.join(sessionDir, 'solution.py');
        const inputFile = path.join(sessionDir, 'input.txt');
        await fs.writeFile(pyFile, code, 'utf-8');
        await fs.writeFile(inputFile, input, 'utf-8');

        dockerCmd = [
          'docker run',
          '--rm',
          `--name ${containerName}`,
          `--memory=${memoryMb}m`,
          '--cpus=0.5',
          '--network none',
          `--volume "${volumePath}:/app"`,
          '--workdir /app',
          'coderank-python:latest',
          'bash -c "sleep 0.1 && python solution.py < input.txt"',
        ].join(' ');

        const start = performance.now();
        const { stdout, stderr } = await execAsync(dockerCmd, { timeout: timeoutMs, killSignal: 'SIGKILL', maxBuffer: 2 * 1024 * 1024 });
        const duration = performance.now() - start;

        return {
          success: true,
          stdout: stdout || '',
          stderr: stderr || '',
          runtimeMs: duration,
          exitCode: 0
        };

      } else if (language === 'cpp') {
        const cppFile = path.join(sessionDir, 'solution.cpp');
        const inputFile = path.join(sessionDir, 'input.txt');
        await fs.writeFile(cppFile, code, 'utf-8');
        await fs.writeFile(inputFile, input, 'utf-8');

        // We use a short delay before compiling to allow WSL2 9p filesystem to sync the file on Windows
        dockerCmd = [
          'docker run',
          '--rm',
          `--name ${containerName}`,
          `--memory=${memoryMb}m`,
          '--cpus=0.5',
          '--network none',
          `--volume "${volumePath}:/app"`,
          '--workdir /app',
          'coderank-cpp:latest',
          'bash -c "sleep 0.1 && g++ -O2 solution.cpp -o solution 2> compile_err.txt && ./solution < input.txt || cat compile_err.txt >&2"',
        ].join(' ');

        const start = performance.now();
        try {
          const { stdout, stderr } = await execAsync(dockerCmd, { timeout: timeoutMs, killSignal: 'SIGKILL', maxBuffer: 2 * 1024 * 1024 });
          const duration = performance.now() - start;

          // If stderr contains compilation errors but exit code is 0, we still return success.
          // However, if the command fails, it throws an error which we catch below.
          return {
            success: true,
            stdout: stdout || '',
            stderr: stderr || '',
            runtimeMs: duration,
            exitCode: 0
          };
        } catch (execErr) {
          if (execErr.killed) throw execErr; // caught by outer block
          // Distinguish between compile error and runtime error
          // The bash command returns the exit code of whatever failed.
          // If g++ failed, it prints to compile_err.txt which we echo to stderr.
          return {
            success: false,
            status: 'compile_error',
            compileError: execErr.stderr || execErr.message || 'Execution failed',
            exitCode: 1
          };
        }
      } else if (language === 'c') {
        const cFile = path.join(sessionDir, 'solution.c');
        const inputFile = path.join(sessionDir, 'input.txt');
        await fs.writeFile(cFile, code, 'utf-8');
        await fs.writeFile(inputFile, input, 'utf-8');

        dockerCmd = [
          'docker run',
          '--rm',
          `--name ${containerName}`,
          `--memory=${memoryMb}m`,
          '--cpus=0.5',
          '--network none',
          `--volume "${volumePath}:/app"`,
          '--workdir /app',
          'coderank-c:latest',
          'bash -c "sleep 0.1 && gcc -O2 solution.c -o solution 2> compile_err.txt && ./solution < input.txt || cat compile_err.txt >&2"',
        ].join(' ');

        const start = performance.now();
        try {
          const { stdout, stderr } = await execAsync(dockerCmd, { timeout: timeoutMs, killSignal: 'SIGKILL', maxBuffer: 2 * 1024 * 1024 });
          const duration = performance.now() - start;

          return {
            success: true,
            stdout: stdout || '',
            stderr: stderr || '',
            runtimeMs: duration,
            exitCode: 0
          };
        } catch (execErr) {
          if (execErr.killed) throw execErr;
          return {
            success: false,
            status: 'compile_error',
            compileError: execErr.stderr || execErr.message || 'Execution failed',
            exitCode: 1
          };
        }

      } else if (language === 'java') {
        const javaFile = path.join(sessionDir, 'Solution.java');
        const inputFile = path.join(sessionDir, 'input.txt');
        await fs.writeFile(javaFile, code, 'utf-8');
        await fs.writeFile(inputFile, input, 'utf-8');

        dockerCmd = [
          'docker run',
          '--rm',
          `--name ${containerName}`,
          `--memory=${memoryMb}m`,
          '--cpus=0.5',
          '--network none',
          `--volume "${volumePath}:/app"`,
          '--workdir /app',
          'coderank-java:latest',
          'bash -c "sleep 0.1 && javac Solution.java 2> compile_err.txt && java Solution < input.txt || cat compile_err.txt >&2"',
        ].join(' ');

        const start = performance.now();
        try {
          const { stdout, stderr } = await execAsync(dockerCmd, { timeout: timeoutMs, killSignal: 'SIGKILL', maxBuffer: 2 * 1024 * 1024 });
          const duration = performance.now() - start;

          return {
            success: true,
            stdout: stdout || '',
            stderr: stderr || '',
            runtimeMs: duration,
            exitCode: 0
          };
        } catch (execErr) {
          if (execErr.killed) throw execErr;
          return {
            success: false,
            status: 'compile_error',
            compileError: execErr.stderr || execErr.message || 'Execution failed',
            exitCode: 1
          };
        }

      } else if (language === 'javascript') {
        const jsFile = path.join(sessionDir, 'solution.js');
        const inputFile = path.join(sessionDir, 'input.txt');
        await fs.writeFile(jsFile, code, 'utf-8');
        await fs.writeFile(inputFile, input, 'utf-8');

        dockerCmd = [
          'docker run',
          '--rm',
          `--name ${containerName}`,
          `--memory=${memoryMb}m`,
          '--cpus=0.5',
          '--network none',
          `--volume "${volumePath}:/app"`,
          '--workdir /app',
          'coderank-javascript:latest',
          'bash -c "sleep 0.1 && node solution.js < input.txt"',
        ].join(' ');

        const start = performance.now();
        const { stdout, stderr } = await execAsync(dockerCmd, { timeout: timeoutMs, killSignal: 'SIGKILL', maxBuffer: 2 * 1024 * 1024 });
        const duration = performance.now() - start;

        return {
          success: true,
          stdout: stdout || '',
          stderr: stderr || '',
          runtimeMs: duration,
          exitCode: 0
        };

      } else {
        return {
          success: false,
          stderr: `Unsupported language for standard I/O execution: ${language}`,
          exitCode: 400
        };
      }

    } catch (execErr) {
      if (execErr.killed) {
        await execAsync(`docker rm -f ${containerName}`).catch(() => {});
        return {
          success: false,
          status: 'time_limit_exceeded',
          stderr: 'Time Limit Exceeded',
          exitCode: 124
        };
      }
      return {
        success: false,
        status: 'runtime_error',
        stdout: execErr.stdout || '',
        stderr: execErr.stderr || execErr.message || 'Runtime exception',
        exitCode: execErr.code ?? 1
      };
    } finally {
      try {
        await fs.rm(sessionDir, { recursive: true, force: true });
      } catch {}
    }
  });
}
