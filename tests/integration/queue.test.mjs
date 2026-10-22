import test from 'node:test';
import assert from 'node:assert/strict';
import { Queue, Worker } from 'bullmq';
import { admissionBackend, sweepOwnerIndexes } from '../../packages/queue/src/index.js';
const connection = { host: '127.0.0.1', port: Number(process.env.REDIS_PORT || 6379), maxRetriesPerRequest: null };
test('atomic admission caps concurrent producers, isolates owners and recovers completed slots', async () => {
 const name = `admission-${Date.now()}`;
 const queues = Array.from({length:4},()=>new Queue(name,{connection},admissionBackend(7,2)));
 let worker;
 try {
  const results = await Promise.allSettled(Array.from({length:40},(_,i)=>queues[i%4].add('run',{userId:`owner-${i%10}`},{jobId:`job-${i}`})));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,7);
  assert.equal(await queues[0].getWaitingCount(),7);
  const jobs = await queues[0].getJobs(['waiting']);
  const counts = new Map();for (const job of jobs) counts.set(job.data.userId,(counts.get(job.data.userId)||0)+1);
  assert.ok([...counts.values()].every(n=>n<=2));
  worker = new Worker(name,async()=>({ok:true}),{connection,concurrency:4});
  const deadline = Date.now()+10000;
  while (await queues[0].getCompletedCount() < 7) { if(Date.now()>deadline) throw Error('Worker did not drain queue'); await new Promise(r=>setTimeout(r,20)); }
  await worker.close();worker=null;
  // One-off owners must disappear even if they never enqueue again.
  const state={cursor:'0',pending:[]};
  do{await sweepOwnerIndexes(queues[0],state);}while(state.cursor!=='0'||state.pending.length);
  const client=await queues[0].getBackend().client;
  for(const owner of counts.keys())assert.equal(await client.exists(queues[0].toKey('owner:'+owner)),0);
  await queues[0].add('run',{userId:'same'},{jobId:'a'});
  await queues[1].add('run',{userId:'same'},{jobId:'b'});
  await assert.rejects(queues[2].add('run',{userId:'same'},{jobId:'c'}),/OWNER_QUEUE_FULL/);
  await queues[0].pause();
  await queues[3].add('run',{userId:'other'},{jobId:'d'});
  assert.equal(await queues[0].getWaitingCount(),3);
  const pendingState={cursor:'0',pending:[]};
  do{await sweepOwnerIndexes(queues[0],pendingState);}while(pendingState.cursor!=='0'||pendingState.pending.length);
  await assert.rejects(queues[2].add('run',{userId:'same'},{jobId:'still-full'}),/OWNER_QUEUE_FULL/);
 } finally {
  if(worker) await worker.close();
  await queues[0].obliterate({force:true});
  await Promise.all(queues.map(q=>q.close()));
 }
});
