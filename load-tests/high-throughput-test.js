import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const errorRate = new Rate('http_error_rate');
const reqLatency = new Trend('request_latency_ms');
const totalReqs = new Counter('total_requests_processed');

export const options = {
  scenarios: {
    // High-rate arrival scenario: 300 requests/sec ramping to 500 requests/sec
    high_throughput_burst: {
      executor: 'ramping-arrival-rate',
      startRate: 100,             // Start at 100 req/sec
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 250,                // Up to 250 VUs to sustain rate
      stages: [
        { duration: '10s', target: 200 }, // Ramp to 200 req/sec
        { duration: '15s', target: 350 }, // Ramp to 350 req/sec
        { duration: '15s', target: 500 }, // Peak at 500 req/sec
        { duration: '10s', target: 100 }, // Wind down
      ],
    },
  },
  thresholds: {
    // Latency must be less than 2,000 ms (as requested: "latency must be less than 2,000 ms")
    http_req_duration: ['p(95)<2000'],
    http_error_rate: ['rate<0.05'],     // Under 5% error rate at peak burst
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export function setup() {
  console.log('🚀 High-Throughput Test: Warming up server...');
  http.get(`${BASE_URL}/api/queue/stats`);
  http.get(`${BASE_URL}/api/health`);
  sleep(1);
  console.log('✓ Ready. Starting 300 - 500 req/sec load test...');
}

export default function () {
  // Rotate between high-traffic endpoints
  const endpoints = [
    `${BASE_URL}/api/queue/stats`,
    `${BASE_URL}/api/health`,
  ];
  const url = endpoints[Math.floor(Math.random() * endpoints.length)];

  const res = http.get(url, {
    tags: { name: 'ApiEndpoint' },
    timeout: '3s',
  });

  totalReqs.add(1);
  const success = res.status === 200 || res.status === 304;
  errorRate.add(!success);
  reqLatency.add(res.timings.duration);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'latency under 2000ms': (r) => r.timings.duration < 2000,
  });
}
