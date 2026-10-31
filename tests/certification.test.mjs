import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSystemEvidence, writeCertification } from '../scripts/ci/write-certification.mjs';
const evidence = () => ({ browser:{stats:{expected:5,unexpected:0,flaky:0,skipped:0}},capacity:{passed:true,completed:12,workload:{jobsRequested:12},failures:[]},recovery:{webReplacementMs:1,executionRecoveryMs:1},database:{status:'complete',completedAt:new Date().toISOString()} });
test('certification rejects incomplete, flaky, skipped, failed and missing system evidence', async () => {
  validateSystemEvidence(evidence());
  for (const key of ['browser','capacity','recovery','database']) {
    const value=evidence(); delete value[key]; assert.throws(() => validateSystemEvidence(value));
  }
  for (const key of ['flaky','skipped','unexpected']) { const value=evidence(); value.browser.stats[key]=1; assert.throws(() => validateSystemEvidence(value)); }
  const value=evidence(); value.capacity.completed=11; assert.throws(() => validateSystemEvidence(value));
  await assert.rejects(writeCertification('.',{}),/GitHub Actions/);
});
