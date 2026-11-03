import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import {
  formatStatus,
  formatPreflight,
  getUnitDetails,
  buildSummary,
  writeSummary,
} from '../scripts/ci/generate-summary.mjs';

const root = path.resolve(import.meta.dirname, '..');

test('quick-checks workflow has PR-only triggers and correct step IDs and env bindings', () => {
  const workflowPath = path.join(root, '.github/workflows/quick-checks.yml');
  const content = fs.readFileSync(workflowPath, 'utf8');
  const doc = yaml.load(content);

  // Trigger preservation check
  assert.ok(doc.on.pull_request, 'must trigger on pull_request');
  assert.equal(doc.on.push, undefined, 'must NOT trigger on push');

  const steps = doc.jobs['lint-and-preflight'].steps;
  const stepIds = steps.map(s => s.id).filter(Boolean);

  assert.ok(stepIds.includes('install'), 'must have install step id');
  assert.ok(stepIds.includes('lint'), 'must have lint step id');
  assert.ok(stepIds.includes('migrate'), 'must have migrate step id');
  assert.ok(stepIds.includes('preflight'), 'must have preflight step id');
  assert.ok(stepIds.includes('unit'), 'must have unit step id');

  // Verify unit test step name does not contain hardcoded counts
  const unitStep = steps.find(s => s.id === 'unit');
  assert.ok(unitStep, 'unit step must exist');
  assert.ok(!unitStep.name.includes('192 tests'), 'unit step must not hardcode test counts');

  // Verify summary step
  const summaryStep = steps.find(s => s.name === 'Generate summary report');
  assert.ok(summaryStep, 'summary step must exist');
  assert.equal(summaryStep.if, 'always()', 'summary step must run always()');
  assert.equal(summaryStep.env.OUTCOME_INSTALL, '${{ steps.install.outcome }}');
  assert.equal(summaryStep.env.OUTCOME_LINT, '${{ steps.lint.outcome }}');
  assert.equal(summaryStep.env.OUTCOME_MIGRATE, '${{ steps.migrate.outcome }}');
  assert.equal(summaryStep.env.OUTCOME_PREFLIGHT, '${{ steps.preflight.outcome }}');
  assert.equal(summaryStep.env.OUTCOME_UNIT, '${{ steps.unit.outcome }}');
  assert.match(summaryStep.run, /generate-summary\.mjs/);
});

test('architecture-checks workflow has PR-only triggers', () => {
  const workflowPath = path.join(root, '.github/workflows/architecture-checks.yml');
  const content = fs.readFileSync(workflowPath, 'utf8');
  const doc = yaml.load(content);

  assert.ok(Object.hasOwn(doc.on, 'pull_request'), 'must trigger on pull_request');
  assert.equal(doc.on.push, undefined, 'must NOT trigger on push');
});

test('formatStatus maps GitHub Actions outcomes correctly', () => {
  assert.equal(formatStatus('success'), '✅ Passed');
  assert.equal(formatStatus('failure'), '❌ Failed');
  assert.equal(formatStatus('skipped'), '⚪ Skipped');
  assert.equal(formatStatus('cancelled'), '⏹️ Cancelled');
  assert.equal(formatStatus('unexpected'), '❓ Unknown (unexpected)');
});

test('formatPreflight maps GitHub Actions outcomes correctly', () => {
  assert.equal(formatPreflight('success'), '✅ Current & Verified');
  assert.equal(formatPreflight('failure'), '❌ Failed');
  assert.equal(formatPreflight('skipped'), '⚪ Skipped');
  assert.equal(formatPreflight('cancelled'), '⏹️ Cancelled');
  assert.equal(formatPreflight('unexpected'), '❓ Unknown (unexpected)');
});

test('getUnitDetails derives status and count only on verified success', () => {
  const sampleTapSuccess = [
    'TAP version 13',
    'ok 1 - test a',
    'ok 2 - test b',
    '1..2',
    '# tests 2',
    '# pass 2',
    '# fail 0',
  ].join('\n');

  const sampleTapFail = [
    'TAP version 13',
    'ok 1 - test a',
    'not ok 2 - test b',
    '1..2',
    '# tests 2',
    '# pass 1',
    '# fail 1',
  ].join('\n');

  // Successful run with TAP
  const successResult = getUnitDetails('success', sampleTapSuccess);
  assert.equal(successResult.label, 'Unit Test Suite (2 tests)');
  assert.equal(successResult.status, '✅ All Passed');

  // Success without TAP or with corrupted TAP
  const noTapResult = getUnitDetails('success', null);
  assert.equal(noTapResult.label, 'Unit Test Suite');
  assert.equal(noTapResult.status, '✅ Passed');

  // Failure run: even with TAP content, must NEVER show All Passed or count
  const failResult = getUnitDetails('failure', sampleTapSuccess);
  assert.equal(failResult.label, 'Unit Test Suite');
  assert.equal(failResult.status, '❌ Failed');

  // TAP reporting failure
  const tapFailResult = getUnitDetails('failure', sampleTapFail);
  assert.equal(tapFailResult.label, 'Unit Test Suite');
  assert.equal(tapFailResult.status, '❌ Failed');

  // Skipped run
  const skipResult = getUnitDetails('skipped', sampleTapSuccess);
  assert.equal(skipResult.label, 'Unit Test Suite');
  assert.equal(skipResult.status, '⚪ Skipped');

  // Cancelled run
  const cancelResult = getUnitDetails('cancelled', null);
  assert.equal(cancelResult.label, 'Unit Test Suite');
  assert.equal(cancelResult.status, '⏹️ Cancelled');
});

test('buildSummary generates correct markdown matrix for different pipeline runs', () => {
  // Scenario 1: All success
  const allSuccess = buildSummary(
    {
      OUTCOME_INSTALL: 'success',
      OUTCOME_LINT: 'success',
      OUTCOME_MIGRATE: 'success',
      OUTCOME_PREFLIGHT: 'success',
      OUTCOME_UNIT: 'success',
    },
    '# tests 215\n# pass 215\n# fail 0'
  );
  assert.match(allSuccess, /\| Dependency Installation \| ✅ Passed \|/);
  assert.match(allSuccess, /\| Critical Linting \| ✅ Passed \|/);
  assert.match(allSuccess, /\| Database Migrations \| ✅ Passed \|/);
  assert.match(allSuccess, /\| Database Schema Preflight \| ✅ Current & Verified \|/);
  assert.match(allSuccess, /\| Unit Test Suite \(215 tests\) \| ✅ All Passed \|/);

  // Scenario 2: Lint failure (downstream skipped)
  const lintFail = buildSummary({
    OUTCOME_INSTALL: 'success',
    OUTCOME_LINT: 'failure',
    OUTCOME_MIGRATE: 'skipped',
    OUTCOME_PREFLIGHT: 'skipped',
    OUTCOME_UNIT: 'skipped',
  });
  assert.match(lintFail, /\| Dependency Installation \| ✅ Passed \|/);
  assert.match(lintFail, /\| Critical Linting \| ❌ Failed \|/);
  assert.match(lintFail, /\| Database Migrations \| ⚪ Skipped \|/);
  assert.match(lintFail, /\| Database Schema Preflight \| ⚪ Skipped \|/);
  assert.match(lintFail, /\| Unit Test Suite \| ⚪ Skipped \|/);
  assert.doesNotMatch(lintFail, /✅ All Passed/);

  // Scenario 3: Unit test failure
  const unitFail = buildSummary(
    {
      OUTCOME_INSTALL: 'success',
      OUTCOME_LINT: 'success',
      OUTCOME_MIGRATE: 'success',
      OUTCOME_PREFLIGHT: 'success',
      OUTCOME_UNIT: 'failure',
    },
    '# tests 215\n# pass 214\n# fail 1'
  );
  assert.match(unitFail, /\| Unit Test Suite \| ❌ Failed \|/);
  assert.doesNotMatch(unitFail, /✅ All Passed/);
  assert.doesNotMatch(unitFail, /\(215 tests\)/);

  // Scenario 4: Preflight failure
  const preflightFail = buildSummary({
    OUTCOME_INSTALL: 'success',
    OUTCOME_LINT: 'success',
    OUTCOME_MIGRATE: 'success',
    OUTCOME_PREFLIGHT: 'failure',
    OUTCOME_UNIT: 'skipped',
  });
  assert.match(preflightFail, /\| Database Schema Preflight \| ❌ Failed \|/);
  assert.match(preflightFail, /\| Unit Test Suite \| ⚪ Skipped \|/);
});

test('writeSummary writes output to GITHUB_STEP_SUMMARY if defined', (t) => {
  const tmpFile = path.join(root, 'test-results', `temp-summary-${Date.now()}.md`);
  fs.mkdirSync(path.dirname(tmpFile), { recursive: true });

  try {
    const env = {
      OUTCOME_INSTALL: 'success',
      OUTCOME_LINT: 'success',
      OUTCOME_MIGRATE: 'success',
      OUTCOME_PREFLIGHT: 'success',
      OUTCOME_UNIT: 'success',
      GITHUB_STEP_SUMMARY: tmpFile,
    };
    writeSummary(env, root);
    const content = fs.readFileSync(tmpFile, 'utf8');
    assert.match(content, /### 🚀 Fast CI Check Results/);
    assert.match(content, /Dependency Installation/);
  } finally {
    if (fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile);
    }
  }
});
