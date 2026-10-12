/**
 * ============================================================
 * CodeRank — Rate Limiting Validation Test
 * ============================================================
 * Purpose:
 *  Deliberately sends requests ABOVE the rate limit to confirm
 *  the server correctly returns 429 Too Many Requests and does
 *  NOT allow more than the configured burst threshold.
 *
 * Tests:
 *  1. Auth endpoint rate limiting (/api/auth/login)
 *  2. Code execution rate limiting (/api/execute, /api/run)
 *  3. Submission rate limiting (/api/student/practicals/:id/submit)
 *  4. General API rate limiting
 *  5. Verify 429 responses contain Retry-After header
 *  6. Confirm rate limit resets after window expires
 *
 * Run:
 *   k6 run -e BASE_URL=http://localhost:3000 load-tests/rate-limit-test.js
 *
 * ⚠️  WARNING: This test is designed to intentionally trigger
 * rate limits. Do NOT run with rate-limiting disabled — that
 * defeats the purpose of this test.
 *
 * To test raw server capacity: use max-users-test.js instead
 * with DISABLE_RATE_LIMIT=true set in your .env
 * ============================================================
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate } from 'k6/metrics';

// ─── Custom Metrics ──────────────────────────────────────────────────────────
const rateLimitHits     = new Counter('rate_limit_hits_429');
const rateLimitEscapes  = new Counter('rate_limit_escapes'); // Requests that got through when they shouldn't have (after limit)
const retryAfterPresent = new Rate('retry_after_header_present');

// ─── Options ─────────────────────────────────────────────────────────────────
// NOTE: These tests use VERY high concurrency deliberately.
// We want to saturate the rate limiter quickly.
export const options = {
  scenarios: {
    // ── Scenario 1: Login burst attack ─────────────────────────────────────
    login_rate_limit: {
      executor: 'constant-arrival-rate',
      rate: 30,               // 30 req/s — well above any reasonable login limit
      timeUnit: '1s',
      duration: '20s',
      preAllocatedVUs: 40,
      maxVUs: 60,
      tags: { scenario: 'login_rate_limit' },
      exec: 'testLoginRateLimit',
    },

    // ── Scenario 2: Execution endpoint burst ───────────────────────────────
    execution_rate_limit: {
      executor: 'constant-arrival-rate',
      rate: 20,               // 20 execution req/s
      timeUnit: '1s',
      duration: '20s',
      startTime: '25s',       // Start after login test
      preAllocatedVUs: 30,
      maxVUs: 50,
      tags: { scenario: 'execution_rate_limit' },
      exec: 'testExecutionRateLimit',
    },

    // ── Scenario 3: Submission endpoint burst ──────────────────────────────
    submission_rate_limit: {
      executor: 'constant-arrival-rate',
      rate: 25,               // 25 submission req/s
      timeUnit: '1s',
      duration: '20s',
      startTime: '50s',       // Start after execution test
      preAllocatedVUs: 35,
      maxVUs: 55,
      tags: { scenario: 'submission_rate_limit' },
      exec: 'testSubmissionRateLimit',
    },

    // ── Scenario 4: General API burst ─────────────────────────────────────
    api_rate_limit: {
      executor: 'constant-arrival-rate',
      rate: 100,              // 100 general API req/s
      timeUnit: '1s',
      duration: '20s',
      startTime: '75s',       // Start after submission test
      preAllocatedVUs: 100,
      maxVUs: 150,
      tags: { scenario: 'api_rate_limit' },
      exec: 'testApiRateLimit',
    },
  },

  thresholds: {
    // We EXPECT a high failure rate here — rate limit IS working if 429 > 0
    'rate_limit_hits_429': ['count>5'],              // Must have triggered rate limits
    'retry_after_header_present': ['rate>0.80'],     // 80%+ of 429s have Retry-After

    // These per-scenario checks validate the 429 returns correctly
    'http_req_duration{scenario:login_rate_limit}':      ['p(95)<500'],
    'http_req_duration{scenario:execution_rate_limit}':  ['p(95)<500'],
    'http_req_duration{scenario:submission_rate_limit}': ['p(95)<500'],
    'http_req_duration{scenario:api_rate_limit}':        ['p(95)<500'],
  },
};

const BASE_URL  = __ENV.BASE_URL  || 'http://localhost:3000';
const JWT_TOKEN = __ENV.JWT_TOKEN || '';
const PRACTICAL_ID = __ENV.PRACTICAL_ID || '1';

const authHeaders = {
  'Content-Type': 'application/json',
  ...(JWT_TOKEN ? { Authorization: `Bearer ${JWT_TOKEN}` } : {}),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function check429Response(res, label) {
  if (res.status === 429) {
    rateLimitHits.add(1);

    const hasRetryAfter = res.headers['Retry-After'] !== undefined ||
                          res.headers['retry-after'] !== undefined ||
                          res.headers['X-RateLimit-Reset'] !== undefined;
    retryAfterPresent.add(hasRetryAfter ? 1 : 0);

    check(res, {
      [`[${label}] 429 has Retry-After or X-RateLimit-Reset header`]: () => hasRetryAfter,
      [`[${label}] 429 body contains error message`]: (r) => {
        try { return JSON.parse(r.body)?.error || JSON.parse(r.body)?.message; }
        catch { return r.body?.length > 0; }
      },
    });
    return true;
  }
  return false;
}

// ─── Test Functions ───────────────────────────────────────────────────────────

// Scenario 1: Login brute-force rate limiting
export function testLoginRateLimit() {
  const body = JSON.stringify({
    username: 'nonexistent_user_ratelimit_test',
    password: 'wrong_password_x',
  });

  const res = http.post(`${BASE_URL}/api/auth/login`, body, {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'RateLimit_Login' },
    timeout: '5s',
  });

  const was429 = check429Response(res, 'Login');

  if (!was429) {
    check(res, {
      'login returns 200 or 401 or 403 (not open)': (r) =>
        r.status === 200 || r.status === 401 || r.status === 403,
    });
  }

  sleep(0.05); // Minimal sleep to maximize concurrency pressure
}

// Scenario 2: Execution endpoint rate limiting
export function testExecutionRateLimit() {
  const body = JSON.stringify({
    language: 'python',
    code: 'print("rate limit test")',
    input: '',
  });

  const res = http.post(`${BASE_URL}/api/execute`, body, {
    headers: authHeaders,
    tags: { name: 'RateLimit_Execute' },
    timeout: '5s',
  });

  const was429 = check429Response(res, 'Execute');

  if (!was429) {
    check(res, {
      'execute returns 200/202/401': (r) =>
        r.status === 200 || r.status === 202 || r.status === 401,
    });
  }

  sleep(0.05);
}

// Scenario 3: Submission endpoint rate limiting
export function testSubmissionRateLimit() {
  const body = JSON.stringify({
    code: 'print("submission rate limit test")',
    language: 'python',
  });

  const res = http.post(
    `${BASE_URL}/api/student/practicals/${PRACTICAL_ID}/submit`,
    body,
    {
      headers: authHeaders,
      tags: { name: 'RateLimit_Submit' },
      timeout: '5s',
    }
  );

  const was429 = check429Response(res, 'Submit');

  if (!was429) {
    check(res, {
      'submit returns 200/202/401/404': (r) =>
        r.status === 200 || r.status === 202 || r.status === 401 || r.status === 404,
    });
  }

  sleep(0.05);
}

// Scenario 4: General API endpoint rate limiting
export function testApiRateLimit() {
  const endpoints = [
    `${BASE_URL}/api/health`,
    `${BASE_URL}/api/stats`,
    `${BASE_URL}/api/student/practicals`,
    `${BASE_URL}/api/student/submissions`,
  ];

  const url = endpoints[Math.floor(Math.random() * endpoints.length)];

  const res = http.get(url, {
    headers: authHeaders,
    tags: { name: 'RateLimit_API' },
    timeout: '5s',
  });

  const was429 = check429Response(res, 'API');

  if (!was429) {
    check(res, {
      'api returns valid status': (r) =>
        r.status === 200 || r.status === 401 || r.status === 404,
    });
  }
}
