import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// Helper function to run the docker command asynchronously with STDIN piping
function runContainerWithStdin({ volumePath, containerName, stdinText, timeoutMs = 5000, memoryMb = 128 }) {
  return new Promise((resolve) => {
    // Spawn the docker command:
    // docker run -i --rm --name <name> --memory=128m --cpus=0.5 --network none -v <vol>:/app -w /app python:3.12-slim python solution.py
    const args = [
      'run',
      '-i',
      '--rm',
      '--name', containerName,
      `--memory=${memoryMb}m`,
      '--cpus=0.5',
      '--network', 'none',
      '-v', `${volumePath}:/app`,
      '-w', '/app',
      'python:3.12-slim',
      'python', 'solution.py'
    ];

    const child = spawn('docker', args, {
      timeout: timeoutMs,
      killSignal: 'SIGKILL'
    });

    let stdout = '';
    let stderr = '';
    const start = performance.now();

    child.stdout.on('data', (data) => {
      if (stdout.length < 8192) {
        stdout += data.toString();
      } else if (!stdout.endsWith('\n...[Output truncated to 8KB]')) {
        stdout += '\n...[Output truncated to 8KB]';
      }
    });

    child.stderr.on('data', (data) => {
      if (stderr.length < 8192) {
        stderr += data.toString();
      } else if (!stderr.endsWith('\n...[Output truncated to 8KB]')) {
        stderr += '\n...[Output truncated to 8KB]';
      }
    });

    child.on('close', (code) => {
      const timeMs = Math.round(performance.now() - start);
      // Status determinations
      let status = 'success';
      if (code === 137) {
        status = 'memory_limit_exceeded';
      } else if (code !== 0) {
        status = 'runtime_error';
      }
      resolve({
        success: code === 0,
        status,
        stdout,
        stderr,
        exitCode: code ?? 1,
        timeMs
      });
    });

    child.on('error', (err) => {
      const timeMs = Math.round(performance.now() - start);
      resolve({
        success: false,
        status: 'internal_error',
        stdout,
        stderr: err.message,
        exitCode: 1,
        timeMs
      });
    });

    // Write input into stdin
    if (stdinText) {
      child.stdin.write(stdinText);
    }
    child.stdin.end();
  });
}

export async function POST(request) {
  const uuid = crypto.randomUUID();
  const tmpBase = path.join(process.cwd(), '.tmp');
  const sessionDir = path.join(tmpBase, `compiler-${uuid}`);

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON payload.' }, { status: 400 });
    }

    const { code } = body;
    const stdin = body.input !== undefined ? body.input : (body.stdin || '');

    if (!code || typeof code !== 'string' || code.trim() === '') {
      return NextResponse.json({ success: false, error: 'Code cannot be empty.' }, { status: 400 });
    }

    // ── 1. Create workspace ──
    await fs.mkdir(sessionDir, { recursive: true });
    await fs.writeFile(path.join(sessionDir, 'solution.py'), code, 'utf-8');

    // ── 2. Run under Docker with STDIN ──
    const volumePath = sessionDir.replace(/\\/g, '/');
    const containerName = `py_comp_${uuid.slice(0, 8)}`;

    const result = await runContainerWithStdin({
      volumePath,
      containerName,
      stdinText: stdin,
      timeoutMs: 5000,
      memoryMb: 128
    });

    // ── 3. Return output ──
    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('API Error in /api/practice-run:', error);
    return NextResponse.json({
      success: false,
      status: 'internal_error',
      stdout: '',
      stderr: error.message,
      exitCode: 500,
      timeMs: 0
    }, { status: 500 });
  } finally {
    // ── 4. Async cleanup ──
    fs.rm(sessionDir, { recursive: true, force: true }).catch(() => {});
  }
}

// GET method checks host Docker state
export async function GET() {
  return new Promise((resolve) => {
    const child = spawn('docker', ['images', '-q', 'python:3.12-slim']);
    let stdout = '';
    child.stdout.on('data', (d) => stdout += d.toString());
    child.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        resolve(NextResponse.json({ status: 'healthy', message: 'Docker is running and python:3.12-slim is available.' }));
      } else if (code === 0) {
        resolve(NextResponse.json({ status: 'warning', message: 'Docker is running but python:3.12-slim is missing.' }, { status: 404 }));
      } else {
        resolve(NextResponse.json({ status: 'error', message: 'Docker is offline or not installed.' }, { status: 503 }));
      }
    });
    child.on('error', () => {
      resolve(NextResponse.json({ status: 'error', message: 'Docker is offline or not installed.' }, { status: 503 }));
    });
  });
}
