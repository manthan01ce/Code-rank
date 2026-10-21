import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waitForJob, boundedFetch, responseError } from '../apps/web/src/lib/job-lifecycle.js';
import { practicalPassed } from '../apps/worker/src/execution/runners/verdict.js';

test('passing sample verdict is independent of grading marks', () => {
  assert.equal(practicalPassed({ isSubmit: false, rawMarks: 0, totalMarks: 10, cases: [{ passed: true }] }), true);
  assert.equal(practicalPassed({ isSubmit: false, rawMarks: 0, totalMarks: 10, cases: [] }), false);
  assert.equal(practicalPassed({ isSubmit: false, cases: [{ passed: false }] }), false);
  assert.equal(practicalPassed({ isSubmit: true, rawMarks: 5, totalMarks: 10, cases: [{ passed: true }] }), false);
});
test('job lifecycle handles queue, completion, terminal errors, deadline and navigation', async t => {
  const original = globalThis.fetch;
  try {
    await t.test('queued → active → completed returns result and phases', async () => {
      const phases = [];
      const responses = [{status:'waiting'}, {status:'active'}, {status:'completed',result:{status:'accepted'}}];
      globalThis.fetch = async () => Response.json(responses.shift());
      assert.deepEqual(await waitForJob('test', { intervalMs: 1, onPhase: p=>phases.push(p) }), {status:'accepted'});
      assert.deepEqual(phases, ['Queued','Running']);
    });
    for (const status of [401,403,404,429,503]) {
      await t.test(`HTTP ${status} terminates instead of polling forever`, async () => {
        let requests=0;
        globalThis.fetch = async () => {requests++; return Response.json({}, {status});};
        await assert.rejects(waitForJob('test'), Error);
        assert.equal(requests,1);
      });
    }
    await t.test('worker failure is surfaced', async () => {
      globalThis.fetch = async () => Response.json({status:'failed',failedReason:'Worker lost'});
      await assert.rejects(waitForJob('test'), /Worker lost/);
    });
    await t.test('deadline does not claim job cancellation', async () => {
      globalThis.fetch = async () => Response.json({status:'waiting'});
      await assert.rejects(waitForJob('test',{timeoutMs:5,intervalMs:1}), /may still finish/);
    });
    await t.test('navigation abort interrupts a stalled request', async () => {
      globalThis.fetch = async (_, {signal}) => new Promise((_,reject)=> {
        if(signal.aborted) reject(signal.reason);
        else signal.addEventListener('abort',()=>reject(signal.reason),{once:true});
      });
      const controller=new AbortController();
      const waiting=waitForJob('test',{signal:controller.signal});
      controller.abort(new Error('Navigated'));
      await assert.rejects(waiting,/Navigated/);
      await assert.rejects(boundedFetch('/save',{},5),/timed out/);
    });
    assert.match(responseError(new Response('',{status:429,headers:{'Retry-After':'17'}})),/17 seconds/);
  } finally {globalThis.fetch=original;}
});
