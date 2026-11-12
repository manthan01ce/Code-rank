import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { migrate } from '../../packages/database/src/migrations.js';
import { createExecutionTimings } from '../../apps/worker/src/lifecycle/execution-timings.js';
import { measureExecutionPhase,withExecutionTiming } from '../../packages/runner/src/timing.js';
import { createAnalyticsReports,csvReport } from '../../apps/api/src/modules/analytics/reports.js';
import { retainAnalyticsHistory } from '../../apps/api/src/modules/analytics/retention.js';

const job=(id='1')=>({id,timestamp:Date.now()-100,attemptsMade:0,data:{type:'playground',userId:'private-user',payload:{language:'python',code:'private-source',input:'private-input'}}});

test('phase contexts isolate concurrent jobs, observe failures and leave absent phases unknown',async()=>{
 const a={},b={};let release;const gate=new Promise(r=>{release=r;});
 await Promise.all([
  withExecutionTiming(a,()=>measureExecutionPhase('execute',async()=>{await gate;return 'a';})),
  withExecutionTiming(b,()=>measureExecutionPhase('persist',async()=>{release();return 'b';})),
 ]);
 assert.ok(a.execute>=0);assert.equal(a.persist,undefined);assert.ok(b.persist>=0);assert.equal(b.execute,undefined);
 await assert.rejects(withExecutionTiming(a,()=>measureExecutionPhase('prepare_compile',async()=>{throw Error('compiler unavailable');})),/compiler unavailable/);
 assert.ok(a.prepare_compile>=0);assert.equal(await measureExecutionPhase('execute',async()=>3),3);
});

test('execution recording uses real SQL, preserves null phases, isolates result payloads and retries inserts idempotently',async()=>{
 const db=new PGlite(),query=async(q,p=[]) => (await db.query(q,p)).rows;
 try{
  await migrate({query,apply:m=>db.transaction(async tx=>{for(const s of m.statements)await tx.exec(s);await tx.query('INSERT INTO coderank_migrations(name,checksum) VALUES($1,$2)',[m.name,m.checksum]);})});
  let loseAcknowledgement=true;
  const recorder=createExecutionTimings({enabled:true,query:async(q,p)=>{const result=await query(q,p);if(loseAcknowledgement){loseAcknowledgement=false;throw Error('lost acknowledgement');}return result;}});
  const original={success:true,stdout:'private-output'};
  assert.equal(await recorder.run(job(),()=>measureExecutionPhase('execute',async()=>original)),original);
  await recorder.flush();assert.equal(recorder.state().pending,1);assert.ok(recorder.state().lastError);
  await recorder.flush();assert.equal(recorder.state().pending,0);assert.equal(recorder.state().lastError,null);
  const failed=job('2');failed.timestamp=Date.now()+60000;failed.attemptsMade=1;
  await assert.rejects(recorder.run(failed,()=>measureExecutionPhase('prepare_compile',async()=>{throw Error('private-error');})),/private-error/);
  await recorder.flush();await recorder.stop();
  const rows=await query('SELECT * FROM analytics_execution_timings ORDER BY job_id');
  assert.equal(rows.length,2);assert.ok(rows[0].execute_ms>=0);assert.equal(rows[0].persist_ms,null);assert.equal(rows[1].execute_ms,null);assert.equal(rows[1].queue_ms,null);assert.equal(rows[1].outcome,'worker_error');assert.equal(rows[1].attempt,2);
  assert.doesNotMatch(JSON.stringify(rows),/private-/);
  const report=await createAnalyticsReports(query).execution({hours:24});assert.equal(report.summary[0].jobs,2);assert.equal(report.summary[0].execute_observations,1);assert.equal(report.summary[0].persist_observations,0);assert.ok(report.summary[0].p95_worker_ms>=0);assert.equal(report.recent.length,2);assert.match(csvReport(report.recent),/worker_ms/);
  await query("UPDATE analytics_execution_timings SET observed_at=now()-interval '40 days'");
  assert.equal((await retainAnalyticsHistory(query)).find(x=>x.table==='analytics_execution_timings').rows,2);
  await retainAnalyticsHistory(query,{apply:true});assert.equal((await query('SELECT * FROM analytics_execution_timings')).length,0);
 }finally{await db.close();}
});

test('disabled recording performs no writes; outages keep a bounded buffer and never change job outcomes',async()=>{
 let writes=0;const query=async()=>{writes++;throw Error('database offline');};
 const disabled=createExecutionTimings({query,enabled:false});assert.equal(await disabled.run(job(),async()=>42),42);await disabled.flush();assert.equal(writes,0);
 const recorder=createExecutionTimings({query,enabled:true});
 for(let i=0;i<205;i++)assert.equal(await recorder.run(job(String(i)),async()=>7),7);
 assert.equal(writes,0,'No monitoring DB operation on the processor critical path');
 assert.equal(recorder.state().pending,200);assert.equal(recorder.state().dropped,5);
 await Promise.all([recorder.flush(),recorder.flush()]);assert.equal(writes,1,'Only one batch in flight');assert.ok(recorder.state().lastError);assert.equal(recorder.state().pending,200);await recorder.stop();
});
