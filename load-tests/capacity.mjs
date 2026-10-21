import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { successfulExecution } from './lib/execution-result.js';
import { checkDeployment } from '../scripts/lib/deployment-readiness.mjs';

function integer(value, fallback, min, max, name) {
  const n = Number(value ?? fallback);
  if (!Number.isSafeInteger(n) || n < min || n > max) throw Error(`${name} must be an integer from ${min} to ${max}`);
  return n;
}
export function capacityOptions(env = process.env) {
  if (!env.BASE_URL) throw Error('BASE_URL is required; capacity tests never choose an implicit target');
  const url = new URL(env.BASE_URL);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) throw Error('BASE_URL must be an HTTP(S) origin without credentials, query or path');
  const minThroughput = Number(env.CAPACITY_MIN_RPS ?? 0);
  if (!Number.isFinite(minThroughput) || minThroughput < 0 || minThroughput > 100000) throw Error('CAPACITY_MIN_RPS must be between 0 and 100000');
  return {
    baseURL: url.origin,
    token: env.JWT_TOKEN || '',
    jobs: integer(env.CAPACITY_JOBS, 100, 1, 10_000, 'CAPACITY_JOBS'),
    concurrency: integer(env.CAPACITY_CONCURRENCY, 4, 1, 64, 'CAPACITY_CONCURRENCY'),
    durationMs: integer(env.CAPACITY_DURATION_MS, 60_000, 100, 300_000, 'CAPACITY_DURATION_MS'),
    jobTimeoutMs: integer(env.CAPACITY_JOB_TIMEOUT_MS, 30_000, 100, 60_000, 'CAPACITY_JOB_TIMEOUT_MS'),
    pollMs: integer(env.CAPACITY_POLL_MS, 250, 10, 5000, 'CAPACITY_POLL_MS'),
    p95TargetMs: integer(env.CAPACITY_P95_MS, 10_000, 1, 300_000, 'CAPACITY_P95_MS'),
    minThroughput,
  };
}
async function responseJson(response, label) {
  if (!response.ok) throw Error(`${label}: HTTP ${response.status}`);
  try { return await response.json(); } catch { throw Error(`${label}: invalid JSON`); }
}
async function executeOne(options, sequence, deadline) {
  const expected = `coderank-capacity-${sequence}`;
  const signal = AbortSignal.timeout(Math.max(1, Math.ceil(Math.min(options.jobTimeoutMs, deadline - performance.now()))));
  const headers = { 'Content-Type': 'application/json', ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) };
  const enqueueResponse = await fetch(`${options.baseURL}/api/execute`, {
    method: 'POST', headers, signal, redirect: 'error',
    body: JSON.stringify({ language: 'python', code: `print('${expected}')`, input: '' }),
  });
  const enqueue = await responseJson(enqueueResponse, 'Admission');
  if (enqueueResponse.status !== 202 || enqueue.success !== true || typeof enqueue.jobId !== 'string' || !enqueue.jobId) throw Error('Admission: expected accepted job ID');
  // Each anonymous iteration retains its own ownership cookie. Never share a
  // cookie jar between concurrent virtual users or print authentication data.
  const cookie = enqueueResponse.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  if (cookie) headers.Cookie = cookie;
  while (true) {
    signal.throwIfAborted();
    const job = await responseJson(await fetch(`${options.baseURL}/api/jobs/${encodeURIComponent(enqueue.jobId)}`, { headers, signal, redirect: 'error' }), 'Polling');
    if (job.status === 'completed') {
      if (!successfulExecution(job, expected)) throw Error('Execution completed with incorrect output or unsuccessful result');
      return;
    }
    if (!['waiting', 'active', 'delayed', 'waiting-children', 'prioritized'].includes(job.status)) throw Error(`Execution ended in unexpected state: ${String(job.status).slice(0, 40)}`);
    await new Promise((resolve, reject) => {
      const onAbort = () => { clearTimeout(timer); reject(signal.reason); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve(); }, options.pollMs);
      signal.addEventListener('abort', onAbort, { once: true });
      if (signal.aborted) onAbort();
    });
  }
}
function percentile(values, fraction) {
  return values.length ? values.slice().sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1] : null;
}
export async function runCapacity(options) {
  // Probe database/Redis/worker readiness, then actual execution, before measuring.
  const readiness = await checkDeployment(options.baseURL);
  await executeOne(options, 'readiness', performance.now() + options.jobTimeoutMs);
  const started = performance.now(), deadline = started + options.durationMs;
  let attempted = 0, completed = 0;
  const latencies = [], failures = [];
  await Promise.all(Array.from({ length: Math.min(options.concurrency, options.jobs) }, async () => {
    while (!failures.length && attempted < options.jobs && performance.now() < deadline) {
      const sequence = ++attempted, start = performance.now();
      try { await executeOne(options, sequence, deadline); completed++; latencies.push(performance.now() - start); }
      catch (error) { failures.push({ sequence, reason: error.name === 'TimeoutError' ? 'Job or run deadline exceeded' : error.message }); }
    }
  }));
  const elapsedMs = performance.now() - started;
  const throughput = completed / (elapsedMs / 1000), p95Ms = percentile(latencies, .95);
  const report = {
    scope: 'Measured execution smoke capacity for this target and workload only; not a production capacity guarantee.',
    target: options.baseURL,
    readiness,
    admissionPolicy: options.token ? 'Authenticated run limits remain enabled.' : 'All anonymous sessions share one rate-limit bucket; distinct ownership cookies do not increase the anonymous rate allowance.',
    workload: { language: 'python', jobsRequested: options.jobs, concurrency: options.concurrency, maxDurationMs: options.durationMs },
    attempted, completed, failures, elapsedMs, achievedRps: throughput,
    latencyMs: { p50: percentile(latencies, .5), p95: p95Ms, max: latencies.length ? Math.max(...latencies) : null },
    thresholds: { allJobsCompleted: completed === options.jobs && failures.length === 0, p95Ms: options.p95TargetMs, minimumRps: options.minThroughput },
  };
  report.passed = report.thresholds.allJobsCompleted && p95Ms !== null && p95Ms <= options.p95TargetMs && throughput >= options.minThroughput;
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = await runCapacity(capacityOptions());
    console.log(JSON.stringify(report, null, 2));
    if (!report.passed) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ passed: false, error: error.message }));
    process.exitCode = 1;
  }
}
