import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Counter, Rate, Trend } from 'k6/metrics';

const base = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const mode = __ENV.MODE || 'smoke';
if (!['smoke', 'api', 'run', 'submission', 'concurrency'].includes(mode)) throw new Error('Invalid MODE');
const vus = mode === 'smoke' ? 1 : Number(__ENV.VUS || 200);
if (!Number.isInteger(vus) || vus < 1) throw new Error('VUS must be a positive integer');
const fixtures = new SharedArray('student-fixtures', () => JSON.parse(open(__ENV.FIXTURES || './students.local.json')));
if (fixtures.length < vus) throw new Error(`Need ${vus} distinct student fixtures`);
if (new Set(fixtures.map(f => f.token)).size !== fixtures.length) throw new Error('Student tokens must be distinct');
for (const f of fixtures) {
  if (!f.token || !f.practicalId || !f.language || !f.code || f.expectedStatus !== 'accepted') {
    throw new Error('Each fixture requires token, practicalId, language, known-correct code, expectedStatus: accepted');
  }
}
const success = new Rate('flow_success');
const accepted = new Counter('jobs_accepted');
const completed = new Counter('jobs_completed');
const completion = new Trend('job_completion_ms', true);
const queueWait = new Trend('queue_wait_ms', true);
const workerTime = new Trend('worker_time_ms', true);
const deadline = Number(__ENV.JOB_DEADLINE_MS || 60000);
const scenarios = mode === 'concurrency' || mode === 'smoke'
  ? { qualification: { executor: 'per-vu-iterations', vus, iterations: 1, maxDuration: '3m' } }
  : { qualification: { executor: 'ramping-vus', startVUs: 0, stages: [
    { duration: '30s', target: Math.min(20, vus) },
    { duration: '30s', target: Math.min(50, vus) },
    { duration: '30s', target: Math.min(100, vus) },
    { duration: '30s', target: vus }, { duration: '2m', target: vus },
    { duration: '30s', target: 0 },
  ], gracefulRampDown: '70s', gracefulStop: '70s' } };
const thresholds = {
  checks: ['rate==1'], flow_success: ['rate>0.99'],
  http_req_failed: ['rate<0.01'], dropped_iterations: ['count==0'],
  'http_req_duration{operation:read}': ['p(95)<1000'],
};
if (mode !== 'api') {
  Object.assign(thresholds, {
    jobs_accepted: [`count>=${mode === 'concurrency' ? vus : 1}`],
    jobs_completed: [`count>=${mode === 'concurrency' ? vus : 1}`],
    job_completion_ms: ['p(95)<15000', 'p(99)<30000'],
    'http_req_duration{operation:enqueue}': ['p(95)<1000'],
  });
}
export const options = { scenarios, thresholds };
function json(res) { try { return res.json(); } catch { return {}; } }
function request(f, operation) {
  return { headers: { Authorization: `Bearer ${f.token}`, 'Content-Type': 'application/json' },
    tags: { operation }, timeout: '10s' };
}
export function setup() {
  const health = http.get(`${base}/api/execute`, { timeout: '10s' });
  if (health.status !== 200 || json(health).status !== 'healthy') throw new Error('Execution target unavailable');
  for (const f of fixtures.slice(0, vus)) {
    const r = http.get(`${base}/api/student/practicals`, request(f, 'preflight'));
    if (r.status !== 200) throw new Error('Student fixture authentication failed');
  }
}
function execute(f, submit) {
  const start = Date.now();
  const url = submit ? `/api/student/practicals/${f.practicalId}/submit` : `/api/${f.language}-run`;
  const r = http.post(`${base}${url}`, JSON.stringify({
    problemId: `practical_${f.practicalId}`, language: f.language, code: f.code,
  }), request(f, 'enqueue'));
  const jobId = json(r).jobId;
  if (!check(r, { 'job accepted with id': res => res.status === 202 && typeof jobId === 'string' })) return false;
  accepted.add(1);
  while (Date.now() - start < deadline) {
    sleep(0.5 + Math.random() * 0.25);
    const poll = http.get(`${base}/api/jobs/${jobId}`, {
      ...request(f, 'poll'), tags: { operation: 'poll', name: '/api/jobs/:id' },
    });
    if (!check(poll, { 'owned job readable': res => res.status === 200 })) return false;
    const data = json(poll);
    if (data.status === 'failed') return false;
    if (data.status === 'completed') {
      completed.add(1);
      completion.add(Date.now() - start);
      if (data.processedOn && data.enqueuedAt) queueWait.add(data.processedOn - data.enqueuedAt);
      if (data.finishedOn && data.processedOn) workerTime.add(data.finishedOn - data.processedOn);
      return check(data, {
        'correct verdict': d => submit ? d.result?.status === f.expectedStatus : ['accepted', 'wrong_answer'].includes(d.result?.status),
        'all cases pass': d => d.result?.cases?.length > 0 && d.result.cases.every(c => c.passed),
        'submission persisted': d => !submit || !!d.result?.submissionId,
      });
    }
  }
  check(false, { 'job finished before deadline': value => value });
  return false;
}
export default function () {
  const f = fixtures[__VU - 1];
  if (mode === 'api') {
    const r = http.get(`${base}/api/student/practicals`, request(f, 'read'));
    success.add(check(r, { 'practicals readable': res => res.status === 200 && Array.isArray(json(res)) }));
    sleep(3);
    return;
  }
  let ok = true;
  if (mode === 'smoke' || mode === 'run') ok = execute(f, false);
  if (mode !== 'run') ok = execute(f, true) && ok;
  success.add(ok);
  // Keep normal per-student submit rate below 5/minute; concurrency is one burst.
  if (mode !== 'concurrency' && mode !== 'smoke') sleep(15);
}
export function handleSummary(data) {
  return { [`qualification-${mode}-summary.json`]: JSON.stringify(data, null, 2) };
}
