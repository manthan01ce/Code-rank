import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
  stages: [
    { duration: '15s', target: 50 },  // Warm up to 50 concurrent users
    { duration: '30s', target: 200 }, // Ramp to 200 concurrent users
    { duration: '1m', target: 400 },  // Peak load at 400 concurrent users
    { duration: '15s', target: 0 },   // Cool down
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],     // Under 5% errors during high load
    http_req_duration: ['p(95)<2500'],  // 95% of API requests under 2.5s
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const JWT_TOKEN = __ENV.JWT_TOKEN || '';

const authHeaders = {
  'Content-Type': 'application/json',
  ...(JWT_TOKEN ? { Authorization: `Bearer ${JWT_TOKEN}` } : {}),
};

export default function () {
  group('1. System Health & Monitoring', () => {
    const health = http.get(`${BASE_URL}/api/health`, { tags: { name: 'HealthCheck' } });
    check(health, { 'health returns 200': (r) => r.status === 200 });

    const queueStats = http.get(`${BASE_URL}/api/queue/stats`, { tags: { name: 'QueueStats' } });
    check(queueStats, { 'queue stats accessible': (r) => r.status === 200 || r.status === 503 });
  });

  sleep(0.3);

  group('2. Public Pages & Gateway', () => {
    const home = http.get(`${BASE_URL}/`, { tags: { name: 'HomePage' } });
    check(home, { 'home page status is 200': (r) => r.status === 200 });

    const studentPage = http.get(`${BASE_URL}/student`, { tags: { name: 'StudentPage' } });
    check(studentPage, { 'student page status is 200': (r) => r.status === 200 });
  });

  sleep(0.5);

  group('3. Authenticated APIs & Course Data', () => {
    if (JWT_TOKEN) {
      const practicals = http.get(`${BASE_URL}/api/student/practicals`, {
        headers: authHeaders,
        tags: { name: 'StudentPracticals' },
      });
      check(practicals, {
        'practicals endpoint responds': (r) => r.status === 200 || r.status === 401,
      });

      const submissions = http.get(`${BASE_URL}/api/student/submissions`, {
        headers: authHeaders,
        tags: { name: 'StudentSubmissions' },
      });
      check(submissions, {
        'submissions endpoint responds': (r) => r.status === 200 || r.status === 401,
      });

      const profile = http.get(`${BASE_URL}/api/auth/profile`, {
        headers: authHeaders,
        tags: { name: 'UserProfile' },
      });
      check(profile, {
        'profile endpoint responds': (r) => r.status === 200 || r.status === 401,
      });
    } else {
      // Test unauthenticated responses return 401 cleanly
      const unauth = http.get(`${BASE_URL}/api/auth/profile`, { tags: { name: 'UnauthCheck' } });
      check(unauth, { 'unauthenticated request is 401': (r) => r.status === 401 });
    }
  });

  sleep(1);
}
