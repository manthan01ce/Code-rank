import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 3 }, // 3 concurrent submissions
    { duration: '20s', target: 6 }, // 6 concurrent submissions
    { duration: '10s', target: 0 }, // Cool down
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],     // 95%+ success rate for Docker sandboxes
    http_req_duration: ['p(90)<4000'],  // 90% of code executions under 4s
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
    timeout: '10s',
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

  sleep(1);
}
