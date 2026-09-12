import { NextResponse } from 'next/server';
import { ALLOWED_LANGUAGES } from '@/lib/execution/index.js';
import { enqueueJob } from '@/lib/queue/jobQueue';
import { checkRateLimit } from '@/lib/queue/rateLimiter';
import { getUserFromRequest } from '@/lib/auth';
import { exec }      from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request) {
  try {
    const user = getUserFromRequest(request);
    const userId = user ? user.id : 'anonymous';

    const rate = await checkRateLimit(userId.toString(), 'run');
    if (!rate.allowed) return NextResponse.json({ error: 'Too Many Requests', retryAfter: rate.retryAfter }, { status: 429 });

    const body = await request.json();
    const { language, code, input } = body;

    if (!language || !ALLOWED_LANGUAGES.has(language)) {
      return NextResponse.json({ success: false, error: `Invalid language. Allowed: ${[...ALLOWED_LANGUAGES].join(', ')}` }, { status: 400 });
    }

    if (!code || typeof code !== 'string' || code.trim() === '') {
      return NextResponse.json({ success: false, error: 'Code cannot be empty.' }, { status: 400 });
    }

    try {
      const jobId = await enqueueJob('playground', { language, code, input: input ?? '' }, user ? user.id : null);
      return NextResponse.json({ jobId, status: 'queued' }, { status: 202 });
    } catch (err) {
      if (err.message === 'QUEUE_FULL') return NextResponse.json({ error: 'Server is busy. Please try again in a moment.' }, { status: 503 });
      throw err;
    }

  } catch (error) {
    console.error('[/api/execute] Unhandled error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  const IMAGES = [
    { image: 'coderank-python-daemon',    lang: 'python'     },
    { image: 'coderank-cpp-daemon',       lang: 'cpp'        },
    { image: 'coderank-c-daemon',         lang: 'c'          },
    { image: 'coderank-java-daemon',      lang: 'java'       },
    { image: 'coderank-javascript-daemon',lang: 'javascript' },
  ];

  try {
    const checks = await Promise.allSettled(
      IMAGES.map(({ image }) => execAsync(`docker ps -q -f name=${image}`))
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
        ? 'All Docker daemons are running.'
        : 'Some daemons are missing. Please start them.',
    });

  } catch {
    return NextResponse.json(
      { status: 'error', message: 'Docker is not running or not installed on this host.' },
      { status: 503 }
    );
  }
}
