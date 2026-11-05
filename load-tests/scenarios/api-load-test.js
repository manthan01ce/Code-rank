import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 20 },   // Gentle warmup to 20 users
    { duration: '20s', target: 50 },   // Ramp to 50 concurrent users
    { duration: '30s', target: 100 },  // Ramp to 100 users
    { duration: '30s', target: 150 },  // Peak load at 150 concurrent users
    { duration: '20s', target: 50 },   // Ramp down to 50
    { duration: '10s', target: 0 },    // Cool down
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],     // Under 5% errors during high load
    http_req_duration: ['p(95)<2000'],  // 95% of API requests under 2s (more realistic)
    'http_req_duration{name:HealthCheck}': ['p(95)<500'],  // Health check fast
    'http_req_duration{name:QueueStats}': ['p(95)<400'],   // Queue stats fast
    'http_req_duration{name:HomePage}': ['p(95)<1500'],    // Pages can be slower
    'http_req_duration{name:StudentPage}': ['p(95)<1500'], // Pages can be slower
  },
  noConnectionReuse: false,  // Reuse connections with keep-alive
  userAgent: 'k6-load-test/1.0',
};

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3000';
const JWT_TOKEN = __ENV.JWT_TOKEN || '';

const authHeaders = {
  'Content-Type': 'application/json',
  ...(JWT_TOKEN ? { Authorization: `Bearer ${JWT_TOKEN}` } : {}),
};

// Warmup function to initialize caches
export function setup() {
  console.log('🔥 Warming up API caches...');
  
  // Hit each endpoint multiple times to warm JIT and caches
  for (let i = 0; i < 3; i++) {
    http.get(`${BASE_URL}/api/health`, { timeout: '3s' });
    http.get(`${BASE_URL}/api/queue/stats`, { timeout: '2s' });
    http.get(`${BASE_URL}/`, { timeout: '5s' });
    http.get(`${BASE_URL}/student`, { timeout: '5s' });
    http.get(`${BASE_URL}/api/auth/profile`, { timeout: '3s', responseCallback: http.expectedStatuses(401) });
    sleep(0.5);
  }
  
  sleep(1);
  console.log('✓ API warmup complete');
  
  return { startTime: new Date().toISOString() };
}

export default function () {
  group('1. System Health & Monitoring', () => {
    const health = http.get(`${BASE_URL}/api/health`, { 
      tags: { name: 'HealthCheck' },
      timeout: '3s',
    });
    check(health, { 
      'health returns 200': (r) => r.status === 200,
      'health responds quickly': (r) => r.timings.duration < 500,
    });

    const queueStats = http.get(`${BASE_URL}/api/queue/stats`, { 
      tags: { name: 'QueueStats' },
      timeout: '2s',
      responseCallback: http.expectedStatuses(200, 503),
    });
    check(queueStats, { 
      'queue stats accessible': (r) => r.status === 200 || r.status === 503,
      'queue stats fast': (r) => r.timings.duration < 400,
    });
  });

  // Brief pause for realistic client cadence
  sleep(0.2);

  group('2. Public Pages & Gateway', () => {
    const home = http.get(`${BASE_URL}/`, { 
      tags: { name: 'HomePage' },
      timeout: '5s',
    });
    check(home, { 
      'home page status is 200': (r) => r.status === 200,
      'home page loads reasonably': (r) => r.timings.duration < 1500,
    });

    const studentPage = http.get(`${BASE_URL}/student`, { 
      tags: { name: 'StudentPage' },
      timeout: '5s',
    });
    check(studentPage, { 
      'student page status is 200': (r) => r.status === 200,
      'student page loads reasonably': (r) => r.timings.duration < 1500,
    });
  });

  // Brief pause
  sleep(0.3);

  group('3. Authenticated APIs & Course Data', () => {
    if (JWT_TOKEN) {
      const practicals = http.get(`${BASE_URL}/api/student/practicals`, {
        headers: authHeaders,
        tags: { name: 'StudentPracticals' },
        timeout: '4s',
        responseCallback: http.expectedStatuses(200, 401),
      });
      check(practicals, {
        'practicals endpoint responds': (r) => r.status === 200 || r.status === 401,
        'practicals reasonably fast': (r) => r.status === 401 || r.timings.duration < 1000,
      });

      const submissions = http.get(`${BASE_URL}/api/student/submissions`, {
        headers: authHeaders,
        tags: { name: 'StudentSubmissions' },
        timeout: '4s',
        responseCallback: http.expectedStatuses(200, 401),
      });
      check(submissions, {
        'submissions endpoint responds': (r) => r.status === 200 || r.status === 401,
        'submissions reasonably fast': (r) => r.status === 401 || r.timings.duration < 1000,
      });

      const profile = http.get(`${BASE_URL}/api/auth/profile`, {
        headers: authHeaders,
        tags: { name: 'UserProfile' },
        timeout: '3s',
        responseCallback: http.expectedStatuses(200, 401),
      });
      check(profile, {
        'profile endpoint responds': (r) => r.status === 200 || r.status === 401,
        'profile fast': (r) => r.status === 401 || r.timings.duration < 500,
      });
    } else {
      // Test unauthenticated responses return 401 cleanly as expected
      const unauth = http.get(`${BASE_URL}/api/auth/profile`, { 
        tags: { name: 'UnauthCheck' },
        timeout: '2s',
        responseCallback: http.expectedStatuses(401),
      });
      check(unauth, { 
        'unauthenticated request is 401': (r) => r.status === 401,
        'auth check fast': (r) => r.timings.duration < 200,
      });
    }
  });

  sleep(0.5);
}

export function teardown(data) {
  console.log(`✅ API Load Test completed. Started at: ${data.startTime}`);
}
