/**
 * ============================================================
 * CodeRank — Maximum User Capacity Test
 * ============================================================
 * Purpose:
 *  Find the ABSOLUTE MAXIMUM concurrent users the server can
 *  handle before degrading. This aggressively ramps users up
 *  until the server breaks, measuring:
 *    - Break point (VU count at first threshold breach)
 *    - Error rate progression by load level
 *    - Response time degradation curve
 *    - Database connection pool exhaustion point
 *    - Memory & CPU pressure indicators (via /api/health)
 *
 * Strategy:
 *  Uses a ramping-arrival-rate executor that keeps pushing
 *  more requests per second until errors accumulate.
 *
 * ⚠️  CRITICAL — READ BEFORE RUNNING:
 *  This test is designed to CRASH or saturate the server.
 *  Before running this test, you MUST:
 *    1. Set DISABLE_RATE_LIMIT=true in .env
 *    2. Set DISABLE_CACHE=true in .env (optional, for raw DB load)
 *    3. Ensure no real users are connected to the server
 *    4. Have server logs open to monitor memory/CPU
 *
 *  Run command:
 *    k6 run \
 *      -e BASE_URL=http://localhost:3000 \
 *      -e JWT_TOKEN=your_token \
 *      -e DISABLE_RATE_LIMIT=true \
 *      load-tests/max-users-test.js
 *
 *  After test: check /api/health endpoint recovers.
 *  Restore rate limiting before real traffic resumes!
 * ============================================================
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend, Gauge } from 'k6/metrics';

// ─── Custom Metrics ──────────────────────────────────────────────────────────
const serverBreakErrors   = new Counter('server_break_errors_5xx');
const timeoutErrors       = new Counter('timeout_errors');
const dbPoolExhausted     = new Counter('db_pool_exhausted_signals');
const requestsAbove5s     = new Counter('requests_above_5s');
const successRate         = new Rate('overall_success_rate');
const responseP99         = new Trend('response_p99_trend');

// ─── Ramp Profile — Aggressive staircase to breaking point ────────────────────
export const options = {
  scenarios: {
    // Primary: Ramp arrival rate (how many req/s) — ignores VU count, tests server saturation
    max_capacity_ramp: {
      executor: 'ramping-arrival-rate',
      startRate: 10,              // 10 req/s at start
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 1000,               // Allow up to 1000 VUs if needed
      stages: [
        { duration: '30s', target: 10  },  // Baseline: 10 req/s
        { duration: '30s', target: 50  },  // Ramp: 50 req/s
        { duration: '30s', target: 100 },  // 100 req/s — typical lab peak
        { duration: '30s', target: 200 },  // 200 req/s — heavy load
        { duration: '30s', target: 350 },  // 350 req/s — stress zone
        { duration: '30s', target: 500 },  // 500 req/s — likely break point
        { duration: '30s', target: 750 },  // 750 req/s — extreme stress
        { duration: '30s', target: 1000},  // 1000 req/s — server saturation
        { duration: '30s', target: 500 },  // Step down to check recovery
        { duration: '30s', target: 100 },  // Recovery confirmation
        { duration: '15s', target: 0   },  // Cool down
      ],
      exec: 'maxCapacityTest',
    },

    // Parallel: Health monitor (1 VU, checks server health during the test)
    health_monitor: {
      executor: 'constant-vus',
      vus: 1,
      duration: '5m45s',
      exec: 'monitorServerHealth',
      tags: { role: 'monitor' },
    },
  },

  thresholds: {
    // We don't set hard pass/fail here — this is a discovery test.
    // Read the output to find where metrics degrade.
    'http_req_failed':              ['rate<0.50'],    // Alert if >50% fail (total collapse)
    'http_req_duration':            ['p(99)<10000'],  // Alert if p99 > 10s
    'server_break_errors_5xx':      ['count<500'],    // Alert if >500 server crashes
    'timeout_errors':               ['count<100'],    // Alert if >100 timeouts
  },
};

const BASE_URL  = __ENV.BASE_URL  || 'http://localhost:3000';
const JWT_TOKEN = __ENV.JWT_TOKEN || '';

const authHeaders = {
  'Content-Type': 'application/json',
  ...(JWT_TOKEN ? { Authorization: `Bearer ${JWT_TOKEN}` } : {}),
};

// Mix of endpoints to test realistic traffic distribution
const API_ENDPOINTS = [
  { method: 'GET',  url: '/api/health',               weight: 5, auth: false },
  { method: 'GET',  url: '/api/stats',                 weight: 5, auth: false },
  { method: 'GET',  url: '/',                          weight: 10, auth: false },
  { method: 'GET',  url: '/login',                     weight: 5, auth: false },
  { method: 'GET',  url: '/api/student/practicals',    weight: 20, auth: true  },
  { method: 'GET',  url: '/api/student/submissions',   weight: 15, auth: true  },
  { method: 'GET',  url: '/api/auth/profile',          weight: 10, auth: true  },
  { method: 'GET',  url: '/api/queue/stats',           weight: 5, auth: false },
  { method: 'GET',  url: '/api/faculty/courses',       weight: 10, auth: true  },
  { method: 'POST', url: '/api/execute',               weight: 15, auth: true,
    body: JSON.stringify({ language: 'python', code: 'print(42)', input: '' }) },
];

// Weighted random picker
function pickEndpoint() {
  const totalWeight = API_ENDPOINTS.reduce((s, e) => s + e.weight, 0);
  let rand = Math.random() * totalWeight;
  for (const ep of API_ENDPOINTS) {
    rand -= ep.weight;
    if (rand <= 0) return ep;
  }
  return API_ENDPOINTS[0];
}

// ─── Main Test Function ───────────────────────────────────────────────────────
export function maxCapacityTest() {
  const ep = pickEndpoint();
  const headers = ep.auth ? authHeaders : { 'Content-Type': 'application/json' };

  let res;
  const start = Date.now();

  try {
    if (ep.method === 'POST') {
      res = http.post(`${BASE_URL}${ep.url}`, ep.body, {
        headers,
        tags: { name: `MaxCap_${ep.url.replace(/\//g, '_')}` },
        timeout: '15s',
      });
    } else {
      res = http.get(`${BASE_URL}${ep.url}`, {
        headers,
        tags: { name: `MaxCap_${ep.url.replace(/\//g, '_')}` },
        timeout: '15s',
      });
    }
  } catch (e) {
    // Request timed out or network error
    timeoutErrors.add(1);
    successRate.add(0);
    return;
  }

  const elapsed = Date.now() - start;
  responseP99.add(elapsed);

  if (elapsed > 5000) {
    requestsAbove5s.add(1);
  }

  // Track server errors
  if (res.status >= 500) {
    serverBreakErrors.add(1);

    // Detect DB pool exhaustion (common error messages)
    try {
      const body = JSON.parse(res.body);
      const msg = (body.error || body.message || '').toLowerCase();
      if (msg.includes('pool') || msg.includes('connection') || msg.includes('timeout')) {
        dbPoolExhausted.add(1);
      }
    } catch (e) {}
  }

  const ok = check(res, {
    'server responds (not 5xx)': (r) => r.status < 500,
    'response time under 10s': () => elapsed < 10000,
  });

  successRate.add(ok ? 1 : 0);
}

// ─── Health Monitor ───────────────────────────────────────────────────────────
export function monitorServerHealth() {
  sleep(2); // Poll every 2 seconds

  const res = http.get(`${BASE_URL}/api/health`, {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'HealthMonitor', role: 'monitor' },
    timeout: '5s',
  });

  check(res, {
    'health check reachable': (r) => r.status < 500,
    'database still healthy': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body?.services?.database?.status === 'healthy';
      } catch { return false; }
    },
    'queue still responsive': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body?.services?.queue !== undefined;
      } catch { return false; }
    },
  });
}
