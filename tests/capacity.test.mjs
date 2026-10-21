import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { capacityOptions, runCapacity } from '../load-tests/capacity.mjs';

async function fixture(mode, run) {
  const jobs = new Map(); let active = 0, peak = 0;
  const server = http.createServer(async (request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Cache-Control', mode === 'cached-health' ? 'public, max-age=60' : 'no-store');
    const reply = (status, body) => { response.statusCode = status; response.end(JSON.stringify(body)); };
    if (request.url === '/api/live') return reply(200, { status: 'ok' });
    if (request.url === '/api/health') return reply(mode === 'unready' ? 503 : 200, {
      status: 'healthy', timestamp: new Date(Date.now() - (mode === 'stale-health' ? 120000 : 0)).toISOString(),
      services: { database: { status: mode === 'db-unready' ? 'degraded' : 'healthy' }, queue: { status: 'healthy' }, execution: { status: 'healthy', healthyWorkers: mode === 'no-workers' ? 0 : 1 } },
    });
    if (request.url === '/api/execute') {
      let body = ''; for await (const chunk of request) body += chunk;
      if (mode === 'redirect') { response.setHeader('Location', '/login'); return reply(302, {}); }
      const expected = JSON.parse(body).code.match(/print\('([^']+)'\)/)[1];
      if (mode === 'rate-limit' && !expected.endsWith('readiness')) return reply(429, { error: 'Too many requests' });
      const id = String(jobs.size + 1); jobs.set(id, { expected, polls: 0 }); active++; peak = Math.max(peak, active);
      response.setHeader('Set-Cookie', `coderank_execution_session=${id}; HttpOnly; SameSite=Lax`);
      return reply(202, { success: true, jobId: id });
    }
    const id = request.url.split('/').at(-1), job = jobs.get(id);
    if (!job) return reply(404, { error: 'Not found' });
    if (request.headers.cookie !== `coderank_execution_session=${id}`) return reply(403, { error: 'Wrong ownership cookie' });
    const measured = !job.expected.endsWith('readiness');
    if (mode === 'poll-error' && measured) return reply(503, { error: 'Redis down' });
    if (mode === 'timeout' && measured) return reply(200, { status: 'active' });
    if (job.polls++ === 0) return reply(200, { status: 'active' });
    active--;
    return reply(200, mode === 'failed' && measured ? { status: 'failed' } : {
      status: 'completed', result: { success: !(mode === 'runtime' && measured), exitCode: mode === 'runtime' && measured ? 1 : 0, stdout: mode === 'wrong-output' && measured ? 'wrong' : job.expected + '\n' },
    });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const options = capacityOptions({ BASE_URL: `http://127.0.0.1:${server.address().port}`, CAPACITY_JOBS: '6', CAPACITY_CONCURRENCY: '3', CAPACITY_POLL_MS: '10', CAPACITY_JOB_TIMEOUT_MS: '300', CAPACITY_DURATION_MS: '2000' });
    await run(options, () => peak);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}

test('capacity runner requires an explicit origin and strictly bounded parameters', () => {
  assert.throws(() => capacityOptions({}), /BASE_URL/);
  for (const BASE_URL of ['file:///tmp', 'http://user:secret@localhost', 'http://localhost?secret=x', 'http://localhost/path']) assert.throws(() => capacityOptions({ BASE_URL }));
  for (const [name, value] of [['CAPACITY_CONCURRENCY','65'], ['CAPACITY_JOBS','0'], ['CAPACITY_DURATION_MS','300001'], ['CAPACITY_JOB_TIMEOUT_MS','1'], ['CAPACITY_MIN_RPS','NaN'], ['CAPACITY_MIN_RPS','100001']]) assert.throws(() => capacityOptions({ BASE_URL: 'http://localhost:1', [name]: value }));
});
test('real loopback capacity run checks output, per-job ownership cookie and bounded concurrency', async () => {
  await fixture('success', async (options, peak) => {
    const report = await runCapacity(options);
    assert.equal(report.passed, true); assert.equal(report.completed, 6); assert.equal(report.attempted, 6);
    assert.equal(report.failures.length, 0); assert.ok(report.achievedRps > 0); assert.ok(report.latencyMs.p95 > 0);
    assert.equal(peak(), 3);
    assert.equal(JSON.stringify(report).includes('Cookie'), false);
  });
});
for (const mode of ['rate-limit', 'poll-error', 'wrong-output', 'runtime', 'failed', 'timeout']) {
  test(`capacity run fails honestly for ${mode}`, async () => {
    await fixture(mode, async options => {
      const report = await runCapacity(options);
      assert.equal(report.passed, false); assert.ok(report.failures.length > 0);
      assert.equal(report.completed, 0); assert.ok(report.attempted <= options.concurrency);
    });
  });
}
test('unready deployment fails before admitting any execution workload', async () => {
  await fixture('unready', async (options, peak) => {
    await assert.rejects(runCapacity(options), /HTTP 503/); assert.equal(peak(), 0);
  });
});
test('achieved throughput and latency thresholds affect the result', async () => {
  await fixture('success', async options => {
    const report = await runCapacity({ ...options, minThroughput: 1_000_000, p95TargetMs: 1 });
    assert.equal(report.completed, options.jobs); assert.equal(report.passed, false);
    assert.equal(report.thresholds.allJobsCompleted, true);
  });
});
test('whole-run deadline bounds outstanding polling and prevents further admissions', async () => {
  await fixture('timeout', async options => {
    const started = performance.now();
    const report = await runCapacity({ ...options, durationMs: 100, jobTimeoutMs: 300, concurrency: 1 });
    assert.equal(report.passed, false); assert.equal(report.attempted, 1);
    assert.equal(report.thresholds.allJobsCompleted, false);
    assert.ok(performance.now() - started < 1500);
  });
});

for (const [mode, message] of [['cached-health', /cached health/], ['stale-health', /stale/], ['db-unready', /database is not ready/], ['no-workers', /No healthy execution worker/], ['redirect', /fetch failed/]]) {
  test(`strict deployment readiness or redirects reject ${mode}`, async () => {
    await fixture(mode, async options => { await assert.rejects(runCapacity(options), message); });
  });
}
