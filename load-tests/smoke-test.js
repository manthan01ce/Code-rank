import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 25,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'], // Less than 1% errors allowed
    http_req_duration: ['p(95)<1500'], // 95% of requests must complete under 1.5s
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // 1. Health check endpoint (verifies DB & Docker connectivity)
  const healthRes = http.get(`${BASE_URL}/api/health`, {
    tags: { name: 'HealthCheck' },
  });
  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
    'database healthy': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.services && body.services.database && body.services.database.status === 'healthy';
      } catch {
        return false;
      }
    },
  });

  // 2. Landing page
  const homeRes = http.get(`${BASE_URL}/`, {
    tags: { name: 'LandingPage' },
  });
  check(homeRes, {
    'home page status is 200': (r) => r.status === 200,
  });

  // 3. Student login/dashboard page
  const studentPageRes = http.get(`${BASE_URL}/student`, {
    tags: { name: 'StudentPage' },
  });
  check(studentPageRes, {
    'student page status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
