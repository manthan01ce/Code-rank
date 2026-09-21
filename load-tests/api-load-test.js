import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
  stages: [
    { duration: '15s', target: 250 }, // Warm up to 250 concurrent users
    { duration: '20s', target: 500 }, // Ramp to 500 concurrent users
    { duration: '2m', target: 500 },  // Sustained peak load at 500 concurrent users for 2 mins
    { duration: '15s', target: 0 },   // Ramp down to 0
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],       // Error rate under 5% under heavy 500 VU load
    http_req_duration: ['p(95)<3000'],    // 95% of requests under 3s
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const JWT_TOKEN = __ENV.JWT_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTI3NiwiZW1haWwiOiIyM2NlMDAxQGNoYXJ1c2F0LmVkdS5pbiIsInJvbGUiOiJzdHVkZW50IiwibmFtZSI6IkxvYWQgVGVzdCBTdHVkZW50IiwiaWF0IjoxNzg5NzE5MjM3LCJleHAiOjE3OTIzMTEyMzd9.iDABNkGUjLYwwNHSYGDnsGctK4RXAQotDM0W8uZBhHg';

const authHeaders = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${JWT_TOKEN}`,
};

export default function () {
  group('1. Public Endpoints', () => {
    // Health Check
    const health = http.get(`${BASE_URL}/api/health`, { tags: { name: 'HealthCheck' } });
    check(health, { 'health is 200': (r) => r.status === 200 });

    // Landing Page
    const home = http.get(`${BASE_URL}/`, { tags: { name: 'HomePage' } });
    check(home, { 'home is 200': (r) => r.status === 200 });
  });

  sleep(0.5);

  group('2. Student Dashboard & Data Retrieval', () => {
    // Student Dashboard Page
    const studentPage = http.get(`${BASE_URL}/student`, { tags: { name: 'StudentPage' } });
    check(studentPage, { 'student page is 200': (r) => r.status === 200 });

    // Authenticated: Fetch assigned practicals
    const practicals = http.get(`${BASE_URL}/api/student/practicals`, {
      headers: authHeaders,
      tags: { name: 'PracticalsList' },
    });
    check(practicals, {
      'practicals list is 200': (r) => r.status === 200,
      'practicals returned array': (r) => {
        try {
          return Array.isArray(JSON.parse(r.body));
        } catch {
          return false;
        }
      },
    });

    // Authenticated: Fetch student submissions
    const submissions = http.get(`${BASE_URL}/api/student/submissions`, {
      headers: authHeaders,
      tags: { name: 'SubmissionsList' },
    });
    check(submissions, {
      'submissions list is 200': (r) => r.status === 200,
      'submissions returned array': (r) => {
        try {
          return Array.isArray(JSON.parse(r.body));
        } catch {
          return false;
        }
      },
    });
  });

  sleep(1);
}
