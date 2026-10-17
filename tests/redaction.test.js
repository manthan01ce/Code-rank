import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactHiddenCases } from '../apps/web/src/lib/queue/jobQueue.js';

test('Stage 1 Redaction: redactHiddenCases', async (t) => {
  const sampleResult = {
    status: 'wrong_answer',
    summary: '1 / 2 cases passed',
    cases: [
      {
        id: 1,
        label: 'Sample 1',
        is_hidden: false,
        input: '5',
        expected: '10',
        actual: '10',
        passed: true,
        stdout: '10\n',
        stderr: '',
        error_message: null
      },
      {
        id: 2,
        label: 'Secret 2',
        is_hidden: true,
        input: '100',
        expected: '200',
        actual: '199',
        passed: false,
        stdout: '199\n',
        stderr: 'off by one',
        error_message: 'Value was 199'
      }
    ]
  };

  await t.test('Student receives redacted hidden test case output', () => {
    const studentUser = { id: 10, role: 'student' };
    const redacted = redactHiddenCases(sampleResult, studentUser);

    // Public test case is unchanged
    assert.equal(redacted.cases[0].input, '5');
    assert.equal(redacted.cases[0].expected, '10');
    assert.equal(redacted.cases[0].actual, '10');

    // Hidden test case is redacted
    assert.equal(redacted.cases[1].input, '[hidden]');
    assert.equal(redacted.cases[1].expected, '[hidden]');
    assert.equal(redacted.cases[1].expected_output, '[hidden]');
    assert.equal(redacted.cases[1].actual, '[hidden — failed]');
    assert.equal(redacted.cases[1].stdout, '');
    assert.equal(redacted.cases[1].stderr, '');
    assert.equal(redacted.cases[1].error_message, 'Hidden test case failed');
  });

  await t.test('Anonymous caller receives redacted hidden test case output', () => {
    const redacted = redactHiddenCases(sampleResult, null);
    assert.equal(redacted.cases[1].input, '[hidden]');
    assert.equal(redacted.cases[1].expected, '[hidden]');
    assert.equal(redacted.cases[1].stdout, '');
  });

  await t.test('Faculty sees full unredacted test case output', () => {
    const facultyUser = { id: 2, role: 'faculty' };
    const unredacted = redactHiddenCases(sampleResult, facultyUser);

    assert.equal(unredacted.cases[1].input, '100');
    assert.equal(unredacted.cases[1].expected, '200');
    assert.equal(unredacted.cases[1].actual, '199');
    assert.equal(unredacted.cases[1].stdout, '199\n');
    assert.equal(unredacted.cases[1].stderr, 'off by one');
  });

  await t.test('Admin sees full unredacted test case output', () => {
    const adminUser = { id: 1, role: 'admin' };
    const unredacted = redactHiddenCases(sampleResult, adminUser);

    assert.equal(unredacted.cases[1].input, '100');
    assert.equal(unredacted.cases[1].expected, '200');
    assert.equal(unredacted.cases[1].actual, '199');
  });
});
