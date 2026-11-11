import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeWorkerRecords } from '../../packages/queue/src/analytics.js';
import { readSandboxContainers } from '../../packages/runner/src/sandbox/telemetry.js';

const now=100000;
const row={id:'worker-one',checkedAt:now,healthy:true,accepting:true,concurrency:4,activeJobs:2,jobs:[{id:'job-1',language:'python',type:'dynamic',startedAt:99000}]};
test('capacity requires fresh measured accepting workers and never treats missing values as free slots',()=>{
  const measured=summarizeWorkerRecords([JSON.stringify(row)],now);
  assert.equal(measured.availableSlots,2);assert.equal(measured.occupiedSlots,2);
  for(const change of [{checkedAt:now-31000},{activeJobs:undefined},{healthy:false},{accepting:false},{activeJobs:5}]) {
    assert.equal(summarizeWorkerRecords([JSON.stringify({...row,...change})],now).availableSlots,null,JSON.stringify(change));
  }
  assert.equal(summarizeWorkerRecords([],now).availableSlots,null);
  assert.equal(summarizeWorkerRecords(['invalid'],now).healthyWorkers,0);
  assert.equal(summarizeWorkerRecords(Array(100).fill(JSON.stringify(row)),now).availableSlots,null,'Truncated fleets cannot claim total capacity');
});
test('container observations restrict Docker reads to owned CodeRank sandboxes and fail explicitly',async()=>{
  const calls=[];
  const result=await readSandboxContainers(async(args)=>{calls.push(args);return {stdout:'aabbccddeeff\n112233445566\n'};});
  assert.equal(result.running,2);assert.equal(result.status,'measured');
  assert.ok(calls[0].some(arg=>arg.startsWith('label=coderank.sandbox.owner=')));
  const missing=await readSandboxContainers(async()=>{throw Error('Docker offline');});assert.equal(missing.running,null);assert.equal(missing.status,'unavailable');
});
