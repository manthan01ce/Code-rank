import assert from 'node:assert/strict';

export async function verifyOperationsContracts({ base, apiBase, adminToken, studentToken, username, otherUsername, ledger, probeOutage }) {
  const beforeLedger = await ledger();
  const call = (origin, path, token, options = {}) => fetch(`${origin}/api/${path}`, {
    ...options, signal: AbortSignal.timeout(10000),
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(options.body ? { 'content-type': 'application/json' } : {}) },
  });
  for (const origin of [apiBase, base]) {
    const live = await call(origin, 'live');
    assert.equal(live.status, 200);
    const health = await call(origin, 'health');
    assert.equal(health.status, 200);
    assert.equal(health.headers.get('cache-control'), 'no-store');
    assert.equal((await health.json()).status, 'healthy');
    assert.ok(['MISS', 'HIT', 'DISABLED'].includes(health.headers.get('x-cache')));
    for (const path of ['health/detailed', 'logs', 'metrics', 'stats']) {
      for (const token of [undefined, studentToken]) {
        const denied = await call(origin, path, token);
        assert.equal(denied.status, 401, path);
        assert.equal(denied.headers.get('cache-control'), 'no-store');
      }
      const allowed = await call(origin, path, adminToken);
      assert.equal(allowed.status, 200, path);
      assert.equal(allowed.headers.get('cache-control'), 'no-store');
    }
    for (const limit of ['0', '101', 'bad']) assert.equal((await call(origin, `logs?limit=${limit}`, adminToken)).status, 400);
    const queue = await call(origin, 'queue/stats');
    assert.equal(queue.status, 200);
    assert.equal(typeof (await queue.json()).waiting, 'number');
    const profile = await call(origin, `profile/${encodeURIComponent(username)}`, studentToken);
    assert.equal(profile.status, 200);
    const payload = await profile.json();
    assert.equal(payload.user.password, undefined);
    assert.equal(payload.user.session_token, undefined);
    for (const item of payload.submissions) {
      for (const field of ['code', 'testcase_results', 'hidden_test_cases', 'expected_output']) assert.equal(item[field], undefined);
    }
    // The legacy PUT contract updates the caller regardless of the displayed handle.
    const otherBefore = await (await call(origin, `profile/${encodeURIComponent(otherUsername)}`, studentToken)).json();
    const updated = await call(origin, `profile/${encodeURIComponent(otherUsername)}`, studentToken, { method: 'PUT', body: JSON.stringify({ name: 'Operations Contract Student' }) });
    assert.equal(updated.status, 200);
    const callerAfter = await (await call(origin, `profile/${encodeURIComponent(username)}`, studentToken)).json();
    const otherAfter = await (await call(origin, `profile/${encodeURIComponent(otherUsername)}`, studentToken)).json();
    assert.equal(callerAfter.user.name, 'Operations Contract Student');
    assert.deepEqual(otherAfter, otherBefore);
    const metrics = await (await call(origin, 'metrics', adminToken)).json();
    assert.ok(metrics.endpoints.some(item => item.path === '/api/profile/:username'));
    assert.ok(metrics.endpoints.every(item => !item.path.includes(username)));
  }
  await probeOutage();
  assert.deepEqual(await ledger(), beforeLedger, 'readiness must never write migration history');
  console.log('Operations/profile contracts passed: real API/gateway, readiness, dependency outage, admin permissions, telemetry, profile ownership/privacy and unchanged ledger');
}
