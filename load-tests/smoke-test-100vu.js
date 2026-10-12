import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 100 }, // Ramp up to 100 users
    { duration: '60s', target: 100 }, // Stay at 100 users for 1 minute
    { duration: '10s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],      // Less than 1% errors allowed
    http_req_duration: ['p(95)<800'],    // 95% of requests must complete under 800ms
    'http_req_duration{name:HealthCheck}': ['p(95)<500'], // Health check should be fast
    'http_req_duration{name:LandingPage}': ['p(95)<1000'], // Landing can be slightly slower
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Warmup function to initialize caches
export function setup() {
  console.log('🔥 Warming up application caches...');
  http.get(`${BASE_URL}/api/health`);
  http.get(`${BASE_URL}/api/queue/stats`);
  http.get(`${BASE_URL}/`);
  sleep(2);
  console.log('✓ Warmup complete');
}

export default function () {
  group('1. Health Check & Diagnostics', () => {
    const healthRes = http.get(`${BASE_URL}/api/health`, {
      tags: { name: 'HealthCheck' },
      timeout: '2s',
    });

    check(healthRes, {
      'health status is 200': (r) => r.status === 200,
      'health response < 500ms': (r) => r.timings.duration < 500,
      'cache header present': (r) => r.headers['X-Cache'] !== undefined,
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
      timeout: '3s',
    });
    check(homeRes, {
      'landing page status is 200': (r) => r.status === 200,
      'landing page loads < 1s': (r) => r.timings.duration < 1000,
    });

    const loginRes = http.get(`${BASE_URL}/login`, {
      tags: { name: 'LoginPage' },
      timeout: '3s',
    });
    check(loginRes, {
      'login page status is 200': (r) => r.status === 200,
      'login page loads < 1s': (r) => r.timings.duration < 1000,
    });
  });

  group('3. Execution Engine Status', () => {
    const queueStatsRes = http.get(`${BASE_URL}/api/queue/stats`, {
      tags: { name: 'QueueStats' },
      timeout: '2s',
    });
    check(queueStatsRes, {
      'queue stats status is 200 or 503': (r) => r.status === 200 || r.status === 503,
      'queue stats response < 300ms': (r) => r.timings.duration < 300,
      'cache header present': (r) => r.headers['X-Cache'] !== undefined,
    });
  });

  sleep(1);
}
