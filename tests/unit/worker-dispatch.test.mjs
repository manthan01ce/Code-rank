import test from 'node:test';
import assert from 'node:assert/strict';
import { createExecutionDispatcher } from '../../apps/worker/src/jobs/execution/dispatch.js';
import { LANGUAGE_IDS, ALLOWED_LANGUAGES, practiceRunners } from '@coderank/runner/languages';
import { ALLOWED_LANGUAGES as intakeLanguages } from '../../packages/core/src/security/execution.js';

test('runner capability identifiers match all five intake languages and dispatch each practice once', async () => {
  assert.deepEqual([...LANGUAGE_IDS].sort(), [...intakeLanguages].sort());
  assert.deepEqual([...ALLOWED_LANGUAGES], [...LANGUAGE_IDS]);
  assert.ok(Object.isFrozen(practiceRunners));
  const calls = [];
  const practice = Object.fromEntries(LANGUAGE_IDS.map(language => [language, async payload => { calls.push(payload); return { language }; }]));
  const dispatch = createExecutionDispatcher({ practice });
  for (const language of LANGUAGE_IDS) {
    const payload = { language, code: 'synthetic source' };
    assert.deepEqual(await dispatch({ data: { type: 'practice', payload } }), { language });
    assert.equal(calls.at(-1), payload);
  }
  assert.equal(calls.length, 5);
  await assert.rejects(dispatch({ data: { type: 'practice', payload: { language: 'toString' } } }), /Unsupported practice language/);
});

test('dynamic dispatch binds actor, stable job identity and enqueue time; playground preserves inputs', async () => {
  let dynamic, playground;
  const dispatch = createExecutionDispatcher({
    dynamic: async payload => { dynamic = payload; return 'graded'; },
    playground: async (...args) => { playground = args; return 'executed'; },
  });
  const data = { type: 'dynamic', userId: 7, enqueuedAt: 123, payload: { userId: 999, jobId: 'untrusted', code: 'source', language: 'c' } };
  assert.equal(await dispatch({ id: 'job-1', timestamp: 456, data }), 'graded');
  assert.equal(dynamic.userId, 7); assert.equal(dynamic.jobId, 'job-1'); assert.equal(dynamic.enqueuedAt, 123);
  await dispatch({ id: 'job-2', timestamp: 456, data: { ...data, enqueuedAt: undefined } });
  assert.equal(dynamic.enqueuedAt, 456);
  assert.equal(await dispatch({ data: { type: 'playground', payload: { language: 'cpp', code: 'code', input: 'stdin' } } }), 'executed');
  assert.deepEqual(playground, ['cpp', 'code', 'stdin']);
  await assert.rejects(dispatch({ data: { type: 'unknown' } }), /Unknown job type/);
});

test('runner implementations remain independent of application, core and database packages', async () => {
  const { readdir, readFile } = await import('node:fs/promises');
  const root = new URL('../../packages/runner/src/', import.meta.url);
  for (const file of await readdir(root)) {
    if (!file.endsWith('.js')) continue;
    const source = await readFile(new URL(file, root), 'utf8');
    assert.doesNotMatch(source, /(?:from\s*|import\s*\()\s*['"][^'"]*(?:@coderank\/(?:core|database)|apps\/)/, file);
  }
});
