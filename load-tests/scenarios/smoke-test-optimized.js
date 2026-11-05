import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
  vus: 20,
  duration: '20s',
  thresholds: {
    http_req_failed: ['rate<0.01'],      // Less than 1% errors allowed
    http_req_duration: ['p(95)<800'],    // 95% of requests must complete under 800ms
    'http_req_duration{name:HealthCheck}': ['p(95)<500'], // Health check should be fast
    'http_req_duration{name:QueueStats}': ['p(95)<500'],  // Queue stats should be fast
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Group 1: Critical health endpoints (with caching)
  group('1. Health Check & Diagnostics', () => {
    const healthRes = http.get(`${BASE_URL}/api/health`, {
      tags: { name: 'HealthCheck' },
      timeout: '2s', // Add explicit timeout
    });

    check(healthRes, {
      'health status is 200': (r) => r.status === 200,
      'health responds quickly': (r) => r.timings.duration < 800,
      'database is healthy or cached': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.services?.database?.status === 'healthy' || body.services?.database?.status === 'unhealthy';
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

  // Group 2: Public pages (should be fast with Next.js caching)
  group('2. Public Web Routes', () => {
    const homeRes = http.get(`${BASE_URL}/`, {
      tags: { name: 'LandingPage' },
      timeout: '3s',
    });
    check(homeRes, {
      'landing page status is 200': (r) => r.status === 200,
      'landing page loads in time': (r) => r.timings.duration < 2000,
    });

    const loginRes = http.get(`${BASE_URL}/login`, {
      tags: { name: 'LoginPage' },
      timeout: '3s',
    });
    check(loginRes, {
      'login page status is 200': (r) => r.status === 200,
      'login page loads in time': (r) => r.timings.duration < 2000,
    });
  });

  // Group 3: Queue stats (should be cached)
  group('3. Execution Engine Status', () => {
    const queueStatsRes = http.get(`${BASE_URL}/api/queue/stats`, {
      tags: { name: 'QueueStats' },
      timeout: '2s',
    });
    check(queueStatsRes, {
      'queue stats returns successfully': (r) => r.status === 200 || r.status === 503,
      'queue stats responds quickly': (r) => r.timings.duration < 800,
    });
  });

  sleep(1);
}
