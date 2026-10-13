import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const JWT_TOKEN = __ENV.JWT_TOKEN || '';
const VUS = Number(__ENV.VUS || 8);
const DURATION = __ENV.DURATION || '30s';
const POLL_INTERVAL_SECONDS = Number(__ENV.POLL_INTERVAL_SECONDS || 0.25);
const MAX_WAIT_SECONDS = Number(__ENV.MAX_WAIT_SECONDS || 30);
const P95_TARGET_MS = Number(__ENV.P95_TARGET_MS || 10000);

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    runner_completion_rate: ['rate>0.95'],
    runner_end_to_end_ms: [`p(95)<${P95_TARGET_MS}`],
  },
};

const completions = new Counter('runner_completions');
const completionRate = new Rate('runner_completion_rate');
const endToEnd = new Trend('runner_end_to_end_ms');

const headers = {
  'Content-Type': 'application/json',
  ...(JWT_TOKEN ? { Authorization: `Bearer ${JWT_TOKEN}` } : {}),
};

export default function () {
  const startedAt = Date.now();
  const body = JSON.stringify({
    language: 'python',
    code: `print('runner-benchmark-vu-${__VU}')`,
    input: '',
  });

  const enqueue = http.post(`${BASE_URL}/api/execute`, body, {
    headers,
    tags: { name: 'RunnerEnqueue' },
    timeout: '10s',
  });

  if (!check(enqueue, { 'runner job accepted': (response) => response.status === 202 })) {
    completionRate.add(false);
    return;
  }

  const jobId = JSON.parse(enqueue.body).jobId;
  const maxAttempts = Math.ceil(MAX_WAIT_SECONDS / POLL_INTERVAL_SECONDS);
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    sleep(POLL_INTERVAL_SECONDS);
    const status = http.get(`${BASE_URL}/api/jobs/${jobId}`, {
      headers,
      tags: { name: 'RunnerPoll' },
      timeout: '10s',
    });

    if (status.status !== 200) continue;
    const job = JSON.parse(status.body);
    if (job.status === 'completed') {
      completions.add(1);
      completionRate.add(true);
      endToEnd.add(Date.now() - startedAt);
      return;
    }
    if (job.status === 'failed') break;
  }

  completionRate.add(false);
}
