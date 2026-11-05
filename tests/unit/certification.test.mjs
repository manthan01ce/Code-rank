import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSystemEvidence, validateBrowserEvidence, writeCertification } from '../../scripts/ci/write-certification.mjs';
const evidence = () => ({ topology:{status:'passed',standardWeb:true,api:true,worker:true,gateway:true,websocket:true,guestOwnership:true}, browser:{stats:{expected:5,unexpected:0,flaky:0,skipped:0}},frontend:{stats:{expected:1,unexpected:0,flaky:0,skipped:0}},capacity:{passed:true,completed:12,workload:{jobsRequested:12},failures:[]},recovery:{webReplacementMs:1,executionRecoveryMs:1},database:{status:'complete',completedAt:new Date().toISOString()} });
test('certification rejects incomplete, flaky, skipped, failed and missing system evidence', async () => {
  validateSystemEvidence(evidence());
  for (const key of ['browser','frontend','capacity','recovery','database','topology']) {
    const value=evidence(); delete value[key]; assert.throws(() => validateSystemEvidence(value));
  }
  for (const key of ['flaky','skipped','unexpected']) { const value=evidence(); value.browser.stats[key]=1; assert.throws(() => validateSystemEvidence(value)); }
  const value=evidence(); value.capacity.completed=11; assert.throws(() => validateSystemEvidence(value));
  await assert.rejects(writeCertification('.',{}),/GitHub Actions/);
});

test('certification cannot conceal a missing quarantine registry or unverified batch coverage', async () => {
  const { assertCertifiableLanes } = await import('../../scripts/ci/write-certification.mjs');
  assert.throws(() => assertCertifiableLanes({}), /Cannot certify/);
  assert.throws(() => assertCertifiableLanes({ quarantine: ['tests/docker/batch-execution.test.js'] }), /Cannot certify/);
  assert.throws(() => assertCertifiableLanes({ quarantine: [] }), /Cannot certify/);
  assert.doesNotThrow(() => assertCertifiableLanes({ quarantine: [], docker: ['tests/docker/batch-execution.test.js'] }));
});

function browserEvidence() {
  return {
    config: { rootDir: '/repo/tests/browser' }, errors: [],
    suites: [{ suites: [{ specs: [{ file: 'role-workflows.spec.mjs', ok: true,
      tests: [{ expectedStatus: 'passed', status: 'expected', results: [{ status: 'passed' }] }],
    }] }] }], stats: { expected: 1, unexpected: 0, skipped: 0, flaky: 0 },
  };
}
test('certification requires actual browser specs and exact discovered file membership', () => {
  const expected = ['tests/browser/role-workflows.spec.mjs'];
  validateBrowserEvidence(browserEvidence(), expected, '/repo');
  for (const mutate of [
    r => { r.suites = []; },
    r => { r.suites[0].suites[0].specs[0].tests = []; },
    r => { r.suites[0].suites[0].specs[0].file = 'missing.spec.mjs'; },
    r => { r.suites[0].suites[0].specs[0].tests[0].results.push({ status: 'passed' }); },
    r => { r.suites[0].suites[0].specs[0].tests[0].expectedStatus = 'failed'; },
    r => { r.suites[0].suites[0].specs[0].tests[0].results[0].status = 'skipped'; },
    r => { r.errors.push({ message: 'interrupted' }); },
    r => { r.stats.expected = 2; },
  ]) {
    const report = browserEvidence(); mutate(report);
    assert.throws(() => validateBrowserEvidence(report, expected, '/repo'));
  }
  assert.throws(() => validateBrowserEvidence(browserEvidence(), [...expected, 'tests/browser/omitted.spec.mjs'], '/repo'));
});
