import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
let failure = false;
const calls = [];
mock.module(new URL('../packages/runner/src/docker.js', import.meta.url).href, { namedExports: { dockerCommand: async (args, options) => {
  calls.push({ args, options });
  if (args[0] === 'rm' || args[0] === 'run') return { stdout: '', stderr: '' };
  if (failure) throw Object.assign(new Error('timeout'), { code: 124 });
  return { stdout: JSON.stringify({ status: 'accepted', cases: [] }), stderr: '' };
} } });
for (const [lang, method] of [['python', 'runPython'], ['cpp', 'runCpp'], ['java', 'runJava']]) {
  const runner = (await import(`../apps/worker/src/execution/runners/${lang}.js`))[method];
  test(`${lang} function runner enforces in-container deadline and cleans its private directory`, async () => {
    calls.length = 0; failure = false;
    await runner({ code: 'source', problem: { id: 1 }, testCases: [] });
    assert.ok(calls.find(c => c.args[0] === 'exec').args.includes('timeout'));
    assert.ok(calls.find(c => c.args[0] === 'exec').args.includes('-i'));
    assert.match(calls.find(c => c.args[0] === 'exec').options.input, /source|c291cmNl/);
    assert.ok(calls.at(-1).args.includes('rm'));
    const first = calls.at(-1).args.at(-1);
    await runner({ code: 'source', problem: { id: 1 }, testCases: [] });
    assert.notEqual(calls.at(-1).args.at(-1), first);
  });
  test(`${lang} timeout returns a failure and still cleans its workspace`, async () => {
    calls.length = 0; failure = true;
    const result = await runner({ code: 'source', problem: { id: 1 }, testCases: [] });
    assert.equal(result.status, 'time_limit_exceeded');
    assert.ok(calls.at(-1).args.includes('rm'));
  });
}
