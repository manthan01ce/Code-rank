import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ─── Custom Metrics ──────────────────────────────────────────────────────────
const errorRate = new Rate('custom_error_rate');
const p95Latency = new Trend('custom_req_latency');
const totalRequests = new Counter('custom_total_requests');

export const options = {
  stages: [
    { duration: '10s', target: 50 },   // Ramp up to 50 VUs
    { duration: '15s', target: 100 },  // Ramp up to 100 VUs
    { duration: '20s', target: 200 },  // Peak at 200 concurrent VUs
    { duration: '15s', target: 200 },  // Sustain 200 VUs
    { duration: '10s', target: 50 },   // Ramp down to 50 VUs
    { duration: '5s', target: 0 },     // Wind down
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],    // Less than 5% HTTP errors under 200 VUs
    http_req_duration: ['p(95)<3000'], // 95% under 3000ms
  },
  noConnectionReuse: false,
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export function setup() {
  console.log('🔥 200 VU Load Test: Warming up...');
  http.get(`${BASE_URL}/api/health`, { timeout: '5s' });
  http.get(`${BASE_URL}/api/queue/stats`, { timeout: '3s' });
  http.get(`${BASE_URL}/`, { timeout: '5s' });
  sleep(1);
  console.log('✓ Warmup complete. Beginning 200 VU load test ramp...');
}

export default function () {
  const routes = [
    { url: `${BASE_URL}/`, tag: 'LandingPage', checkText: 'CodeRank' },
    { url: `${BASE_URL}/login`, tag: 'LoginPage', checkText: 'Sign in' },
    { url: `${BASE_URL}/api/queue/stats`, tag: 'QueueStats', checkStatus: 200 },
    { url: `${BASE_URL}/api/health`, tag: 'HealthCheck', checkStatus: 200 },
  ];

  // Distribute 200 VUs across typical user paths
  const route = routes[__VU % routes.length];

  const res = http.get(route.url, {
    tags: { name: route.tag },
    timeout: '5s',
  });

  totalRequests.add(1);
  const success = res.status === 200 || res.status === 304;
  errorRate.add(!success);
  p95Latency.add(res.timings.duration);

  check(res, {
    'status is 200 or 304': (r) => r.status === 200 || r.status === 304,
    'response under 3s': (r) => r.timings.duration < 3000,
  });

  // Small think time between requests (300ms - 800ms)
  sleep(0.5);
}
