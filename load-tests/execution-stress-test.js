import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '15s', target: 15 }, // Warm up to 15 concurrent submissions
    { duration: '15s', target: 30 }, // Ramp to 30 concurrent submissions
    { duration: '2m', target: 30 },  // Sustained peak load at 30 concurrent submissions for 2 mins
    { duration: '15s', target: 0 },  // Cool down
  ],
  thresholds: {
    http_req_failed: ['rate<0.10'],     // 90%+ success rate under heavy Docker container contention
    http_req_duration: ['p(90)<6000'],  // 90% of code executions under 6s
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const codePayload = JSON.stringify({
  code: 'print("Load testing CodeRank execution sandbox!")\nfor i in range(5):\n    print(f"Iteration {i}")',
  input: '',
});

const headers = {
  'Content-Type': 'application/json',
};

export default function () {
  const res = http.post(`${BASE_URL}/api/practice-run`, codePayload, {
    headers: headers,
    tags: { name: 'PracticeRun' },
    timeout: '15s',
  });

  check(res, {
    'execution status is 200': (r) => r.status === 200,
    'execution succeeded': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true && body.stdout.includes('Iteration 4');
      } catch {
        return false;
      }
    },
  });

  sleep(2);
}
