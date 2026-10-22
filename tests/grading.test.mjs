import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
let failSave = false, replay = null, saved, cleanups = 0;
const practical = { total_marks: 0, end_time: '2026-01-02' };
const cases = [{id:1,input:'secret',expected:'answer',marks:0,is_hidden:true}];
mock.module(new URL('../packages/core/src/db/client.js',import.meta.url).href,{defaultExport: async strings => strings.join('').includes('FROM practicals p') ? [practical] : cases});
mock.module(new URL('../packages/core/src/modules/submissions/SubmissionRepository.js',import.meta.url).href,{namedExports:{findAttempt:async()=>replay,saveAttempt:async a=>{saved=a;if(failSave)throw Error('database unavailable');return a.result;}}});
const { gradePractical } = await import('../packages/core/src/modules/submissions/GradingService.js');
const payload={language:'python',code:'source',dbId:1,userId:1,isSubmit:true,jobId:'job',enqueuedAt:Date.parse('2026-01-01')};
const executor=()=>({compile:async()=>({success:true}),runBatch:async()=>[{passed:false,marksAwarded:0,runtimeMs:1,exitCode:0,actualOutput:'secret'}],cleanup:async()=>{cleanups++;}});
test('zero-mark failed cases cannot pass; queue time determines lateness and hidden cases stay redacted',async()=>{
 const result=await gradePractical(payload,executor);
 assert.equal(result.status,'wrong_answer');assert.equal(saved.isLate,false);
 assert.equal(result.cases[0].input,undefined);assert.equal(result.cases[0].actual_output,undefined);
 assert.equal(cleanups,1);
});
test('database failure rejects the job instead of reporting completed grading',async()=>{
 failSave=true;await assert.rejects(gradePractical(payload,executor),/database unavailable/);failSave=false;assert.equal(cleanups,2);
});
test('replayed completed attempt does not execute code again',async()=>{
 replay={status:'accepted',attemptId:'job'};
 assert.deepEqual(await gradePractical(payload,()=>{throw Error('must not execute');}),replay);replay=null;
});
