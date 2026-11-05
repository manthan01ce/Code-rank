import test from 'node:test';
import assert from 'node:assert/strict';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSystemEvidence, validateBrowserEvidence, validateWarmEvidence, writeCertification } from '../../scripts/ci/write-certification.mjs';
test('browser result cleanup is isolated from unit, Docker and integration evidence', async () => {
  const evidenceRoot = fileURLToPath(new URL('../../test-results/', import.meta.url));
  for (const name of ['playwright.config.mjs','faculty-review.config.mjs']) {
    const config = (await import(`../browser/${name}`)).default;
    assert.equal(typeof config.outputDir, 'string');
    const child = relative(evidenceRoot, config.outputDir);
    assert.ok(child && !child.startsWith('..'), `${name} must clean only its own nested artifact directory`);
  }
});
test('warm disposition certification requires exact clean source, real image, every mode and matching Docker evidence', () => {
  const hashes = { 'docker.tap': 'a'.repeat(64), 'docker.files.json': 'b'.repeat(64) };
  const valid = { status:'passed', commit:'c'.repeat(40), dirty:false, imageCleanup:'removed', imageId:'sha256:'+'d'.repeat(64),
    configurations:['ci','cold','containers','local-database'].map(name => ({name})), commands:[{exitCode:0}], tests:{ok:true},
    artifacts:Object.fromEntries(Object.entries(hashes).map(([key,value]) => ['test-results/'+key,value])) };
  validateWarmEvidence(valid, valid.commit, hashes);
  for (const mutate of [r => {r.commit='e'.repeat(40);},r => {r.dirty=true;},r => {r.imageId=null;},r => {r.configurations.pop();},r => {r.commands[0].exitCode=1;},r => {r.tests.ok=false;},r => {r.artifacts['test-results/docker.tap']='wrong';}]) {
    const value=structuredClone(valid); mutate(value);
    assert.throws(() => validateWarmEvidence(value,valid.commit,hashes));
  }
});
const evidence = () => ({ topology:{status:'passed',standardWeb:true,api:true,worker:true,gateway:true,websocket:true,guestOwnership:true,
  durability:{apiOutageWebAvailable:true,serviceRestart:true,dependencyCrashRecovery:true,volumeContinuity:true,applicationRollback:true,executionAfterRecovery:true,workerOnlyDocker:true,priorSource:'a'.repeat(40),priorApiImage:'sha256:'+'b'.repeat(64),currentImages:{api:{image:'sha256:'+'c'.repeat(64)}}}}, browser:{stats:{expected:5,unexpected:0,flaky:0,skipped:0}},frontend:{stats:{expected:1,unexpected:0,flaky:0,skipped:0}},capacity:{passed:true,completed:12,workload:{jobsRequested:12},failures:[]},recovery:{webReplacementMs:1,executionRecoveryMs:1},database:{status:'complete',completedAt:new Date().toISOString()} });
test('certification rejects omitted durability drills and missing or identical rollback artifacts', () => {
  for (const key of ['apiOutageWebAvailable','serviceRestart','dependencyCrashRecovery','volumeContinuity','applicationRollback','executionAfterRecovery','workerOnlyDocker']) {
    const value = evidence(); value.topology.durability[key] = false;
    assert.throws(() => validateSystemEvidence(value), /durability/);
  }
  for (const mutate of [d => { delete d.priorSource; }, d => { d.priorApiImage = null; }, d => { d.currentImages.api.image = d.priorApiImage; }]) {
    const value = evidence(); mutate(value.topology.durability);
    assert.throws(() => validateSystemEvidence(value), /artifact|images/);
  }
});
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
