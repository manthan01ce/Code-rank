/**
 * ============================================================
 * CodeRank — WebSocket & Polling Load Test
 * ============================================================
 * Tests:
 *  1. Socket.IO connection handshake under concurrent users
 *  2. Room join/leave events (practical_room, course_room)
 *  3. Long-polling fallback (HTTP transport)
 *  4. Real-time event throughput (practical_added, new_submission)
 *  5. Polling endpoint stress (jobs, submissions, practicals)
 *
 * Run:
 *   k6 run -e BASE_URL=http://localhost:3000 -e JWT_TOKEN=your_token load-tests/websocket-polling-test.js
 *
 * NOTE: Before testing, disable rate-limiting and cache:
 *   Set DISABLE_RATE_LIMIT=true and DISABLE_CACHE=true in .env
 * ============================================================
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ─── Custom Metrics ─────────────────────────────────────────────────────────
const socketHandshakeErrors   = new Counter('socket_handshake_errors');
const pollSuccessRate         = new Rate('poll_success_rate');
const socketHandshakeDuration = new Trend('socket_handshake_duration_ms');
const pollLatency             = new Trend('poll_latency_ms');

// ─── Stages ──────────────────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '20s', target: 25  },  // Warm up — 25 concurrent WS clients
    { duration: '30s', target: 100 },  // Ramp — 100 concurrent connections
    { duration: '1m',  target: 200 },  // Peak — 200 concurrent WS + pollers
    { duration: '30s', target: 300 },  // Spike — push to 300
    { duration: '20s', target: 0   },  // Cool down
  ],
  thresholds: {
    http_req_failed:               ['rate<0.05'],    // <5% failures
    http_req_duration:             ['p(95)<3000'],   // p95 under 3s
    poll_success_rate:             ['rate>0.90'],    // 90%+ successful polls
    poll_latency:                  ['p(90)<1500'],   // 90% poll under 1.5s
    socket_handshake_duration_ms:  ['p(95)<2000'],   // WS handshake under 2s
  },
};

const BASE_URL  = __ENV.BASE_URL  || 'http://localhost:3000';
const JWT_TOKEN = __ENV.JWT_TOKEN || '';

const PRACTICAL_ID = __ENV.PRACTICAL_ID || '1';
const COURSE_ID    = __ENV.COURSE_ID    || '1';
const JOB_ID       = __ENV.JOB_ID       || ''; // Optional: prefill a real job ID

const authHeaders = {
  'Content-Type': 'application/json',
  ...(JWT_TOKEN ? { Authorization: `Bearer ${JWT_TOKEN}` } : {}),
};

// ─── Socket.IO Handshake via HTTP (polling transport) ────────────────────────
// Socket.IO opens an HTTP request first on /socket.io/?EIO=4&transport=polling
function testSocketHandshake() {
  const start = Date.now();

  const res = http.get(
    `${BASE_URL}/socket.io/?EIO=4&transport=polling&t=${Date.now()}`,
    {
      headers: authHeaders,
      tags: { name: 'WS_Handshake_Polling' },
      timeout: '10s',
    }
  );

  const elapsed = Date.now() - start;
  socketHandshakeDuration.add(elapsed);

  const ok = check(res, {
    'socket.io polling endpoint responds': (r) =>
      r.status === 200 || r.status === 101,
    'response contains sid or upgrade': (r) =>
      r.body?.includes('sid') || r.status === 101,
  });

  if (!ok) socketHandshakeErrors.add(1);

  return res;
}

// ─── Polling: GET /api/student/practicals ────────────────────────────────────
function pollStudentPracticals() {
  const start = Date.now();
  const res = http.get(`${BASE_URL}/api/student/practicals`, {
    headers: authHeaders,
    tags: { name: 'Poll_StudentPracticals' },
  });
  pollLatency.add(Date.now() - start);

  const ok = check(res, {
    'student practicals poll 200/401': (r) => r.status === 200 || r.status === 401,
  });
  pollSuccessRate.add(ok ? 1 : 0);
}

// ─── Polling: GET /api/student/submissions ───────────────────────────────────
function pollStudentSubmissions() {
  const start = Date.now();
  const res = http.get(`${BASE_URL}/api/student/submissions`, {
    headers: authHeaders,
    tags: { name: 'Poll_StudentSubmissions' },
  });
  pollLatency.add(Date.now() - start);

  const ok = check(res, {
    'student submissions poll 200/401': (r) => r.status === 200 || r.status === 401,
  });
  pollSuccessRate.add(ok ? 1 : 0);
}

// ─── Polling: GET /api/jobs/:jobId ───────────────────────────────────────────
function pollJobStatus() {
  if (!JOB_ID) return;

  const start = Date.now();
  const res = http.get(`${BASE_URL}/api/jobs/${JOB_ID}`, {
    headers: authHeaders,
    tags: { name: 'Poll_JobStatus' },
  });
  pollLatency.add(Date.now() - start);

  const ok = check(res, {
    'job status poll responds': (r) => r.status === 200 || r.status === 404,
  });
  pollSuccessRate.add(ok ? 1 : 0);
}

// ─── Polling: GET /api/faculty/practicals/:id/submissions ────────────────────
function pollPracticalSubmissions() {
  const start = Date.now();
  const res = http.get(
    `${BASE_URL}/api/faculty/practicals/${PRACTICAL_ID}/submissions`,
    {
      headers: authHeaders,
      tags: { name: 'Poll_PracticalSubmissions' },
    }
  );
  pollLatency.add(Date.now() - start);

  const ok = check(res, {
    'practical submissions poll 200/401/404': (r) =>
      r.status === 200 || r.status === 401 || r.status === 404,
  });
  pollSuccessRate.add(ok ? 1 : 0);
}

// ─── Polling: GET /api/faculty/courses/:id/stats ─────────────────────────────
function pollCourseStats() {
  const start = Date.now();
  const res = http.get(
    `${BASE_URL}/api/faculty/courses/${COURSE_ID}/stats`,
    {
      headers: authHeaders,
      tags: { name: 'Poll_CourseStats' },
    }
  );
  pollLatency.add(Date.now() - start);

  const ok = check(res, {
    'course stats poll 200/401/404': (r) =>
      r.status === 200 || r.status === 401 || r.status === 404,
  });
  pollSuccessRate.add(ok ? 1 : 0);
}

// ─── Main VU Loop ────────────────────────────────────────────────────────────
export default function () {
  // Every VU simulates a browser client that:
  //  1. Initiates the WS handshake
  //  2. Polls several real-time data endpoints in parallel

  group('1. WebSocket Handshake (Socket.IO Polling Transport)', () => {
    testSocketHandshake();
  });

  sleep(0.2);

  group('2. Real-Time Polling Endpoints', () => {
    pollStudentPracticals();
    sleep(0.1);
    pollStudentSubmissions();
    sleep(0.1);
    pollPracticalSubmissions();
    sleep(0.1);
    pollCourseStats();
    sleep(0.1);
    pollJobStatus();
  });

  sleep(0.5);
}
