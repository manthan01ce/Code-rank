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
  // Connection management
  batch: 10,  // Batch requests in groups of 10
  batchPerHost: 6,  // Max 6 concurrent requests per host
  // Timeout configurations
  httpDebug: 'full',
  noConnectionReuse: false,  // Reuse connections
  userAgent: 'k6-load-test/1.0',
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const JWT_TOKEN = __ENV.JWT_TOKEN || '';

const authHeaders = {
  'Content-Type': 'application/json',
  ...(JWT_TOKEN ? { Authorization: `Bearer ${JWT_TOKEN}` } : {}),
};

// Warmup function to initialize caches
export function setup() {
  console.log('🔥 Warming up API caches...');
  
  // Hit each endpoint once to warm caches
  http.get(`${BASE_URL}/api/health`);
  http.get(`${BASE_URL}/api/queue/stats`);
  http.get(`${BASE_URL}/`);
  http.get(`${BASE_URL}/student`);
  
  sleep(2);
  console.log('✓ API warmup complete');
  
  return { startTime: new Date().toISOString() };
}

export default function () {
  group('1. System Health & Monitoring', () => {
    const health = http.get(`${BASE_URL}/api/health`, { 
      tags: { name: 'HealthCheck' },
      timeout: '3s',  // Add timeout
    });
    check(health, { 
      'health returns 200': (r) => r.status === 200,
      'health responds quickly': (r) => r.timings.duration < 500,
    });

    const queueStats = http.get(`${BASE_URL}/api/queue/stats`, { 
      tags: { name: 'QueueStats' },
      timeout: '2s',  // Add timeout
    });
    check(queueStats, { 
      'queue stats accessible': (r) => r.status === 200 || r.status === 503,
      'queue stats fast': (r) => r.timings.duration < 400,
    });
  });

  // Reduced sleep for better throughput
  sleep(0.2);

  group('2. Public Pages & Gateway', () => {
    const home = http.get(`${BASE_URL}/`, { 
      tags: { name: 'HomePage' },
      timeout: '5s',  // Add timeout
    });
    check(home, { 
      'home page status is 200': (r) => r.status === 200,
      'home page loads reasonably': (r) => r.timings.duration < 1500,
    });

    const studentPage = http.get(`${BASE_URL}/student`, { 
      tags: { name: 'StudentPage' },
      timeout: '5s',  // Add timeout
    });
    check(studentPage, { 
      'student page status is 200': (r) => r.status === 200,
      'student page loads reasonably': (r) => r.timings.duration < 1500,
    });
  });

  // Reduced sleep for better throughput
  sleep(0.3);

  group('3. Authenticated APIs & Course Data', () => {
    if (JWT_TOKEN) {
      const practicals = http.get(`${BASE_URL}/api/student/practicals`, {
        headers: authHeaders,
        tags: { name: 'StudentPracticals' },
        timeout: '4s',
      });
      check(practicals, {
        'practicals endpoint responds': (r) => r.status === 200 || r.status === 401,
        'practicals reasonably fast': (r) => r.status === 401 || r.timings.duration < 1000,
      });

      const submissions = http.get(`${BASE_URL}/api/student/submissions`, {
        headers: authHeaders,
        tags: { name: 'StudentSubmissions' },
        timeout: '4s',
      });
      check(submissions, {
        'submissions endpoint responds': (r) => r.status === 200 || r.status === 401,
        'submissions reasonably fast': (r) => r.status === 401 || r.timings.duration < 1000,
      });

      const profile = http.get(`${BASE_URL}/api/auth/profile`, {
        headers: authHeaders,
        tags: { name: 'UserProfile' },
        timeout: '3s',
      });
      check(profile, {
        'profile endpoint responds': (r) => r.status === 200 || r.status === 401,
        'profile fast': (r) => r.status === 401 || r.timings.duration < 500,
      });
    } else {
      // Test unauthenticated responses return 401 cleanly
      const unauth = http.get(`${BASE_URL}/api/auth/profile`, { 
        tags: { name: 'UnauthCheck' },
        timeout: '2s',
      });
      check(unauth, { 
        'unauthenticated request is 401': (r) => r.status === 401,
        'auth check fast': (r) => r.timings.duration < 200,
      });
    }
  });

  // Reduced sleep - was 1s, now 0.5s for better throughput
  sleep(0.5);
}

export function teardown(data) {
  console.log(`✅ API Load Test completed. Started at: ${data.startTime}`);
}
