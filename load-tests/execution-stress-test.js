import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
  stages: [
    { duration: '15s', target: 20 },  // Warm up: 20 concurrent submitters
    { duration: '30s', target: 80 },  // Ramp up: 80 concurrent submitters
    { duration: '1m', target: 150 },  // Peak stress: 150 concurrent code executions
    { duration: '15s', target: 0 },   // Cool down
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],      // 95%+ success rate for job submission
    http_req_duration: ['p(90)<4000'],   // 90% of requests responded under 4s
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const JWT_TOKEN = __ENV.JWT_TOKEN || '';

const pythonCode = `
def solve():
    total = sum(i * 2 for i in range(100))
    print(f"Computed total: {total}")
solve()
`;

const payload = JSON.stringify({
  language: 'python',
  code: pythonCode,
  input: '',
});

const headers = {
  'Content-Type': 'application/json',
  ...(JWT_TOKEN ? { Authorization: `Bearer ${JWT_TOKEN}` } : {}),
};

export default function () {
  let jobId = null;

  group('1. Enqueue Code Execution Job', () => {
    const res = http.post(`${BASE_URL}/api/execute`, payload, {
      headers,
      tags: { name: 'EnqueueJob' },
      timeout: '10s',
    });

    const isAccepted = check(res, {
      'job queued or accepted (202 or 200)': (r) => r.status === 202 || r.status === 200,
    });

    if (isAccepted) {
      try {
        const body = JSON.parse(res.body);
        jobId = body.jobId;
      } catch (e) {}
    }
  });

  // If a jobId was returned (async pipeline), poll for completion
  if (jobId) {
    group('2. Poll Job Completion Status', () => {
      let attempts = 0;
      const maxAttempts = 10;
      let completed = false;

      while (attempts < maxAttempts && !completed) {
        sleep(0.5);
        attempts++;

        const statusRes = http.get(`${BASE_URL}/api/jobs/${jobId}`, {
          headers,
          tags: { name: 'PollJobStatus' },
        });

        if (statusRes.status === 200) {
          try {
            const jobData = JSON.parse(statusRes.body);
            if (jobData.status === 'completed' || jobData.status === 'failed') {
              completed = true;
              check(statusRes, {
                'job finished execution': () => true,
              });
              break;
            }
          } catch (e) {}
        }
      }
    });
  }

  sleep(1);
}
