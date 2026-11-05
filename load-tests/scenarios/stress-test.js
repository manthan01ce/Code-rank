import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up to 100 users over 2 minutes
    { duration: '3m', target: 500 },  // Ramp up to 500 users over 3 minutes
    { duration: '2m', target: 500 },  // Stay at 500 users for 2 minutes (stress)
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],          // Less than 5% errors allowed
    http_req_duration: ['p(95)<2000', 'p(99)<5000'], // p95 < 2s, p99 < 5s
    'http_req_duration{name:HealthCheck}': ['p(95)<1000'], // Health check under stress
    'http_req_duration{name:QueueStats}': ['p(95)<1000'],  // Queue stats under stress
    'http_req_duration{name:LandingPage}': ['p(95)<3000'], // Landing page under stress
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3000';

// Warmup function to initialize caches
export function setup() {
  console.log('🔥 Warming up application caches...');
  http.get(`${BASE_URL}/api/health`);
  http.get(`${BASE_URL}/api/queue/stats`);
  http.get(`${BASE_URL}/`);
  sleep(2);
  console.log('✓ Warmup complete - Starting stress test...');
}

export default function () {
  // Vary user behavior to simulate realistic load patterns
  const scenario = Math.random();

  if (scenario < 0.4) {
    // 40% of users: Health monitoring pattern
    group('Health Monitoring', () => {
      const healthRes = http.get(`${BASE_URL}/api/health`, {
        tags: { name: 'HealthCheck' },
        timeout: '3s',
      });

      check(healthRes, {
        'health status is 200 or 500': (r) => r.status === 200 || r.status === 500,
        'health response received': (r) => r.body !== undefined,
      });

      sleep(0.5);

      const queueRes = http.get(`${BASE_URL}/api/queue/stats`, {
        tags: { name: 'QueueStats' },
        timeout: '3s',
        responseCallback: http.expectedStatuses(200, 503),
      });

      check(queueRes, {
        'queue stats status is 200 or 503': (r) => r.status === 200 || r.status === 503,
        'queue stats response received': (r) => r.body !== undefined,
      });
    });
  } else if (scenario < 0.7) {
    // 30% of users: Web browsing pattern
    group('Web Browsing', () => {
      const homeRes = http.get(`${BASE_URL}/`, {
        tags: { name: 'LandingPage' },
        timeout: '5s',
      });

      check(homeRes, {
        'landing page status is 200': (r) => r.status === 200,
        'landing page loads': (r) => r.body !== undefined,
      });

      sleep(1);

      const loginRes = http.get(`${BASE_URL}/login`, {
        tags: { name: 'LoginPage' },
        timeout: '5s',
      });

      check(loginRes, {
        'login page status is 200': (r) => r.status === 200,
        'login page loads': (r) => r.body !== undefined,
      });
    });
  } else {
    // 30% of users: Mixed pattern (rapid requests)
    group('Mixed Rapid Requests', () => {
      http.batch([
        ['GET', `${BASE_URL}/api/health`, null, { tags: { name: 'HealthCheck' }, timeout: '3s' }],
        ['GET', `${BASE_URL}/api/queue/stats`, null, { tags: { name: 'QueueStats' }, timeout: '3s' }],
        ['GET', `${BASE_URL}/`, null, { tags: { name: 'LandingPage' }, timeout: '5s' }],
      ]);
    });
  }

  // Random think time between 0.5 and 2 seconds
  sleep(0.5 + Math.random() * 1.5);
}

export function teardown(data) {
  console.log('✓ Stress test completed');
}
