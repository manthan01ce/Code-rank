import { NextResponse } from 'next/server';
import { executeCode, ALLOWED_LANGUAGES } from '@/lib/execution/index.js';
import { exec }      from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * POST /api/execute
 *
 * Unified multi-language code execution endpoint.
 * Phase 1: Only Python runs; other languages return a 501.
 * Phase 2: Each language becomes executable as its runner is implemented.
 *
 * Body: { language: string, code: string, input?: string }
 *
 * Response: { success: boolean, stdout: string, stderr: string, exitCode: number }
 *
 * NOTE: WorkspaceLayout currently calls /api/python-run directly (Phase 1).
 *       Switch it here once all target languages are implemented.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { language, code, input } = body;

    // ── Validate language ─────────────────────────────────────────────────
    if (!language || !ALLOWED_LANGUAGES.has(language)) {
      return NextResponse.json(
        {
          success: false,
          error:   `Invalid language. Allowed: ${[...ALLOWED_LANGUAGES].join(', ')}`,
        },
        { status: 400 }
      );
    }

    // ── Validate code ─────────────────────────────────────────────────────
    if (!code || typeof code !== 'string' || code.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Code cannot be empty.' },
        { status: 400 }
      );
    }

    const result = await executeCode(language, code, input ?? '');
    return NextResponse.json(result);

  } catch (error) {
    console.error('[/api/execute] Unhandled error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/execute
 *
 * Health check — reports which Docker images are available on the host.
 * Run this before Phase 2 implementation to confirm all images are pulled.
 *
 * Pull missing images:
 *   docker pull python:3.12-slim
 *   docker pull gcc:13
 *   docker pull openjdk:21-slim
 *   docker pull node:20-slim
 *   docker pull golang:1.22-alpine
 */
export async function GET() {
  const IMAGES = [
    { image: 'python:3.12-slim',    lang: 'python'     },
    { image: 'gcc:13',              lang: 'cpp'        },
    { image: 'openjdk:21-slim',     lang: 'java'       },
    { image: 'node:20-slim',        lang: 'javascript' },
    { image: 'golang:1.22-alpine',  lang: 'go'         },
  ];

  try {
    const checks = await Promise.allSettled(
      IMAGES.map(({ image }) => execAsync(`docker images -q ${image}`))
    );

    const status = IMAGES.map(({ image, lang }, i) => ({
      language:  lang,
      image,
      available: checks[i].status === 'fulfilled' && !!checks[i].value?.stdout?.trim(),
    }));

    const allReady  = status.every((s) => s.available);
    const readyLangs = status.filter((s) => s.available).map((s) => s.language);

    return NextResponse.json({
      status:      allReady ? 'healthy' : 'partial',
      images:      status,
      readyLangs,
      message:     allReady
        ? 'All Docker images are available. Ready for Phase 2.'
        : 'Some images are missing. See `images` array for details.',
    });

  } catch {
    return NextResponse.json(
      { status: 'error', message: 'Docker is not running or not installed on this host.' },
      { status: 503 }
    );
  }
}
