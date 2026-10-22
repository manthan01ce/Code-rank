import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const reqDuration = new Trend('api_latency_ms');
const successRate = new Rate('api_success_rate');
const reqCounter = new Counter('api_requests_total');

export const options = {
  scenarios: {
    // Exactly 500 requests at a rate of 100-300 requests per second
    burst_500: {
      executor: 'shared-iterations',
      vus: 50,
      iterations: 500,
      maxDuration: '30s',
    },
  },
  thresholds: {
    // Latency must be less than 2,000 ms as requested
    http_req_duration: ['p(95)<2000'],
    api_success_rate: ['rate>0.99'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export function setup() {
  console.log('⚡ Starting 500 requests batch test (up to 300 req/s)...');
  http.get(`${BASE_URL}/api/queue/stats`);
  http.get(`${BASE_URL}/api/health`);
}

export default function () {
  const url = `${BASE_URL}/api/queue/stats`;
  const res = http.get(url, {
    tags: { name: 'QueueStats' },
    timeout: '5s',
  });

  reqCounter.add(1);
  const ok = res.status === 200;
  successRate.add(ok);
  reqDuration.add(res.timings.duration);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'latency under 2000ms': (r) => r.timings.duration < 2000,
  });
}
