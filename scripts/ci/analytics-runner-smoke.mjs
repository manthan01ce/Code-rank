import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir,writeFile } from 'node:fs/promises';
import { createExecutionQueue,readAnalyticsQueue } from '@coderank/queue';

assert.equal(process.env.CI,'true','Run only in isolated CI');
assert.match(new URL(process.env.DATABASE_URL).pathname,/_test$/);
const out='test-results/analytics';await mkdir(out,{recursive:true});
const queue=createExecutionQueue({host:process.env.REDIS_HOST||'127.0.0.1',port:Number(process.env.REDIS_PORT||6379),maxRetriesPerRequest:1});
let log='',job;const evidence={};
const worker=spawn(process.execPath,['apps/worker/src/index.js'],{env:{...process.env,MAX_CONCURRENT_JOBS:'2',SANDBOX_SCOPE:'analytics-ci',RUNNER_IMAGE:'coderank-base:latest'},stdio:['ignore','pipe','pipe']});
worker.stdout.on('data',chunk=>{log+=chunk;});worker.stderr.on('data',chunk=>{log+=chunk;});
async function until(predicate,message,timeout=30000){
  const end=Date.now()+timeout;
  while(Date.now()<end){
    assert.equal(worker.exitCode,null,`Worker exited unexpectedly: ${log}`);
    const snapshot=await readAnalyticsQueue(queue);
    if(predicate(snapshot))return snapshot;
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  throw Error(message);
}
try{
  evidence.idle=await until(s=>s.capacityStatus==='measured'&&s.availableSlots===2&&s.occupiedSlots===0,'Fresh idle worker must report two available slots');
  job=await queue.add('analytics-runner-ci',{type:'playground',userId:'analytics-runner-ci',payload:{language:'python',code:'while True:\n    pass',input:''}});
  evidence.busy=await until(s=>s.occupiedSlots===1&&s.availableSlots===1&&s.queue.active===1&&s.workers.some(w=>w.activeJobs.some(j=>j.id===job.id)&&w.containers?.running>=1),'A real isolated execution must occupy one slot and show its owned container');
  evidence.released=await until(s=>s.occupiedSlots===0&&s.availableSlots===2&&s.workers.every(w=>w.containers?.running===0),'Completed execution must release its slot and remove the sandbox');
  assert.equal(await job.getState(),'completed');
  const finished=await queue.getJob(job.id);
  assert.equal(finished.returnvalue.success,false,'Infinite-loop execution must finish as a bounded code failure');
  worker.kill('SIGTERM');
  const exited=await new Promise(resolve=>{if(worker.exitCode!==null)resolve(worker.exitCode);else worker.once('exit',resolve);});
  assert.equal(exited,0,'Worker must drain cleanly');
  evidence.offline=await readAnalyticsQueue(queue);
  assert.equal(evidence.offline.healthyWorkers,0);
  assert.equal(evidence.offline.availableSlots,null,'An offline fleet must not report free capacity');
  console.log('Real Docker runner telemetry passed: fresh idle capacity, occupied job/container, bounded execution, released capacity, graceful stop and unknown offline capacity.');
}finally{
  if(worker.exitCode===null){worker.kill('SIGTERM');const deadline=setTimeout(()=>worker.kill('SIGKILL'),15000);deadline.unref();worker.once('exit',()=>clearTimeout(deadline));}
  await job?.remove().catch(()=>{});await queue.close();
  await writeFile(`${out}/runner.log`,log);await writeFile(`${out}/runner-measurements.json`,JSON.stringify(evidence,null,2));
}
