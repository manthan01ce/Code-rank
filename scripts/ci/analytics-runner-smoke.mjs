import sql,{closeDatabase} from '@coderank/database';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir,writeFile } from 'node:fs/promises';
import { createExecutionQueue,readAnalyticsQueue } from '@coderank/queue';

assert.equal(process.env.CI,'true','Run only in isolated CI');
assert.match(new URL(process.env.DATABASE_URL).pathname,/_test$/);
const out='test-results/analytics';await mkdir(out,{recursive:true});
const queue=createExecutionQueue({host:process.env.REDIS_HOST||'127.0.0.1',port:Number(process.env.REDIS_PORT||6379),maxRetriesPerRequest:1});
let log='',job;const evidence={},extraJobs=[];
const worker=spawn(process.execPath,['apps/worker/src/index.js'],{env:{...process.env,ANALYTICS_EXECUTION_ENABLED:'true',MAX_CONCURRENT_JOBS:'2',SANDBOX_SCOPE:'analytics-ci',RUNNER_IMAGE:'coderank-base:latest'},stdio:['ignore','pipe','pipe']});
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
  const [student]=await sql.query("INSERT INTO users(name,email,password,role) VALUES('Timing CI Student','timing-student@ci.example','test-only','student') RETURNING id");
  const [faculty]=await sql.query("INSERT INTO users(name,email,password,role) VALUES('Timing CI Faculty','timing-faculty@ci.example','test-only','faculty') RETURNING id");
  const [course]=await sql.query("INSERT INTO courses(course_code,name,semester) VALUES('TIME-CI','Timing verification',1) RETURNING id");
  const [practical]=await sql.query("INSERT INTO practicals(faculty_id,course_id,title,total_marks,status) VALUES($1,$2,'Timing verification',10,'active') RETURNING id",[faculty.id,course.id]);
  await sql.query("INSERT INTO practical_test_cases(practical_id,input,expected,marks) VALUES($1,'','ok',10)",[practical.id]);
  for(const [language,code] of [['python','print("ok")'],['c','invalid C source']]){
    const submitted=await queue.add('analytics-timing-ci',{type:'dynamic',userId:student.id,payload:{language,code,dbId:practical.id,isSubmit:true}});extraJobs.push(submitted);
    const end=Date.now()+30000;while(Date.now()<end&&await submitted.getState()!=='completed'){await new Promise(resolve=>setTimeout(resolve,150));}
    assert.equal(await submitted.getState(),'completed');
    const result=(await queue.getJob(submitted.id)).returnvalue;
    assert.equal(result.status,language==='python'?'accepted':'compile_error');
    assert.equal(result.timings,undefined,'Operational timings must not enter student results');
  }
  worker.kill('SIGTERM');
  const exited=await new Promise(resolve=>{if(worker.exitCode!==null)resolve(worker.exitCode);else worker.once('exit',resolve);});
  assert.equal(exited,0,'Worker must drain cleanly');
  evidence.timings=await sql.query('SELECT job_id,kind,language,outcome,queue_ms,worker_ms,prepare_compile_ms,execute_ms,persist_ms,cleanup_ms FROM analytics_execution_timings WHERE job_id=ANY($1::text[]) ORDER BY job_id',[[String(job.id),...extraJobs.map(j=>String(j.id))]]);
  assert.equal(evidence.timings.length,3,'Graceful shutdown persists all observed attempts');
  for(const row of evidence.timings){assert.ok(row.queue_ms>=0);assert.ok(row.worker_ms>0);assert.ok(row.prepare_compile_ms>0);assert.ok(row.cleanup_ms>0);}
  const successful=evidence.timings.find(r=>r.kind==='dynamic'&&r.language==='python');assert.ok(successful.execute_ms>0);assert.ok(successful.persist_ms>0);
  const failedCompile=evidence.timings.find(r=>r.language==='c');assert.equal(failedCompile.execute_ms,null);assert.ok(failedCompile.persist_ms>0);
  const timeout=evidence.timings.find(r=>r.kind==='playground');assert.ok(timeout.execute_ms>=4500);assert.equal(timeout.persist_ms,null);
  evidence.offline=await readAnalyticsQueue(queue);
  assert.equal(evidence.offline.healthyWorkers,0);
  assert.equal(evidence.offline.availableSlots,null,'An offline fleet must not report free capacity');
  console.log('Real Docker runner telemetry passed: fresh idle capacity, occupied job/container, bounded execution, released capacity, graceful stop and unknown offline capacity.');
}finally{
  if(worker.exitCode===null){worker.kill('SIGTERM');const deadline=setTimeout(()=>worker.kill('SIGKILL'),15000);deadline.unref();worker.once('exit',()=>clearTimeout(deadline));}
  for(const j of extraJobs)await j.remove().catch(()=>{});
  await job?.remove().catch(()=>{});await queue.close();await closeDatabase();
  await writeFile(`${out}/runner.log`,log);await writeFile(`${out}/runner-measurements.json`,JSON.stringify(evidence,null,2));
}
