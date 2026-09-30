import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
  vus: 20,
  duration: '20s',
  thresholds: {
    http_req_failed: ['rate<0.01'],      // Less than 1% errors allowed
    http_req_duration: ['p(95)<800'],    // 95% of requests must complete under 800ms
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  group('1. Health Check & Diagnostics', () => {
    const healthRes = http.get(`${BASE_URL}/api/health`, {
      tags: { name: 'HealthCheck' },
    });

    check(healthRes, {
      'health status is 200': (r) => r.status === 200,
      'database is healthy': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.services?.database?.status === 'healthy';
        } catch {
          return false;
        }
      },
      'queue service responded': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.services?.queue !== undefined;
        } catch {
          return false;
        }
      },
    });
  });

  group('2. Public Web Routes', () => {
    const homeRes = http.get(`${BASE_URL}/`, {
      tags: { name: 'LandingPage' },
    });
    check(homeRes, {
      'landing page status is 200': (r) => r.status === 200,
    });

    const loginRes = http.get(`${BASE_URL}/login`, {
      tags: { name: 'LoginPage' },
    });
    check(loginRes, {
      'login page status is 200': (r) => r.status === 200,
    });
  });

  group('3. Execution Engine Status', () => {
    const queueStatsRes = http.get(`${BASE_URL}/api/queue/stats`, {
      tags: { name: 'QueueStats' },
    });
    check(queueStatsRes, {
      'queue stats status is 200 or 503': (r) => r.status === 200 || r.status === 503,
    });
  });

  sleep(1);
}
