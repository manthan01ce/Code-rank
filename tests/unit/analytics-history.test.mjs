import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { PGlite } from '@electric-sql/pglite';
import { migrate } from '../../packages/database/src/migrations.js';
import { createAnalyticsRuntime,reconcileIncident } from '../../apps/api/src/modules/analytics/history.js';
import { createAnalyticsReports,csvReport } from '../../apps/api/src/modules/analytics/reports.js';
import { retainAnalyticsHistory } from '../../apps/api/src/modules/analytics/retention.js';
import { hashAnalyticsPassword } from '../../apps/api/src/modules/analytics/auth.js';
import analyticsRoutes from '../../apps/api/src/modules/analytics/analytics.routes.js';
import usageRoutes from '../../apps/api/src/modules/usage/usage.routes.js';
import { usageRoute } from '../../packages/contracts/src/usage.js';

const password='history-test-only-strong-password';
Object.assign(process.env,{ANALYTICS_PASSWORD_HASH:await hashAnalyticsPassword(password),ANALYTICS_SESSION_SECRET:'history-test-session-secret-at-least-32',ANALYTICS_ORIGIN:'https://analytics.example',ANALYTICS_USAGE_SECRET:'a'.repeat(64),ANALYTICS_COLLECTION_ENABLED:'true',ANALYTICS_USAGE_ENABLED:'true'});
const env={...process.env};
function snapshot(healthy=true,requests=20){return {database:{healthy:true},execution:{status:'measured',healthyWorkers:healthy?1:0,availableSlots:healthy?2:null,occupiedSlots:healthy?0:null,workers:[],queue:{waiting:0,active:0,oldestWaitingMs:null}},http:{requests,errors:0,latencyMs:{p95:20},process:{memory:{rss:1048576},eventLoopDelayMs:{p95:1}}}};}
async function database(){
 const db=new PGlite(),query=async(q,p=[]) => (await db.query(q,p)).rows;
 await migrate({query,apply:m=>db.transaction(async tx=>{for(const s of m.statements)await tx.exec(s);await tx.query('INSERT INTO coderank_migrations(name,checksum) VALUES($1,$2)',[m.name,m.checksum]);})});
 return {db,query};
}

test('history persists across restarts, deduplicates minute samples and coordinates fleet incidents',async()=>{
 const {db,query}=await database();let clock=Math.floor(Date.now()/60000)*60000-8*60000,current=snapshot(false),cpu=0;
 const runtime=createAnalyticsRuntime({query,collect:async()=>current,env,instance:'api-a',boot:'boot-a',now:()=>clock,cpu:()=>({user:cpu,system:0})});
 try{
  await runtime.tick();assert.equal(runtime.getState().lastError,null);
  await runtime.tick();assert.equal((await query('SELECT count(*)::int AS n FROM analytics_samples'))[0].n,1,'A retry cannot double sample a minute');
  clock+=60000;current=snapshot(false,40);cpu+=10000;await runtime.tick();
  assert.equal((await query("SELECT count(*)::int AS n FROM analytics_incidents WHERE rule='workers_offline' AND resolved_at IS NULL"))[0].n,1);
  const replica=createAnalyticsRuntime({query,collect:async()=>snapshot(false),env,instance:'api-b',boot:'boot-b',now:()=>clock,cpu:()=>({user:0,system:0})});
  await replica.tick();await replica.stop();
  assert.equal((await query("SELECT count(*)::int AS n FROM analytics_incidents WHERE rule='workers_offline'"))[0].n,1,'A second API process cannot duplicate fleet incidents');
  clock+=60000;current={...snapshot(true,50),execution:{status:'unavailable'}};await runtime.tick();
  assert.equal((await query("SELECT resolved_at FROM analytics_incidents WHERE rule='workers_offline'"))[0].resolved_at,null,'Missing telemetry does not mean recovery');
  clock+=60000;current=snapshot(true,60);await runtime.tick();clock+=60000;current=snapshot(true,80);await runtime.tick();
  assert.ok((await query("SELECT resolved_at FROM analytics_incidents WHERE rule='workers_offline'"))[0].resolved_at);
  await runtime.stop();
  const restarted=createAnalyticsRuntime({query,collect:async()=>snapshot(true,1),env,instance:'api-a',boot:'new-boot',now:()=>clock,cpu:()=>({user:0,system:0})});
  await restarted.tick();
  assert.equal((await query("SELECT request_rate FROM analytics_samples WHERE boot_id='new-boot'"))[0].request_rate,null,'Counter resets do not become negative traffic');
  const report=await createAnalyticsReports(query,restarted).history({hours:24,instance:'api-a'});
  assert.ok(report.points.length>0);assert.equal(Number(report.points[0].minimum_available),2,'Replica gauges are not summed');
  assert.equal(report.instances.length,2);assert.ok(report.releases.length>0);
  await restarted.stop();
 }finally{await runtime.stop();await db.close();}
});

test('usage flushes are idempotent and account counts survive process restarts without browser identifiers',async()=>{
 const {db,query}=await database();let clock=Date.now()-60000;
 const runtime=createAnalyticsRuntime({query,collect:async()=>snapshot(),env:{...env,ANALYTICS_COLLECTION_ENABLED:'false'},instance:'usage-a',boot:'usage-boot',now:()=>clock});
 try{
  runtime.recordPage('/login');runtime.recordPage('/login');
  const req={routeOptions:{url:'/api/execute'},actor:{id:3,role:'student'},analyticsAction:'run_accepted'};
  runtime.recordHttp(req,{statusCode:202});
  runtime.recordHttp({routeOptions:{url:'/api/analytics/overview'},actor:{id:3,role:'student'}},{statusCode:200});
  await runtime.tick();await runtime.tick();
  assert.equal(Number((await query("SELECT sum(events) AS n FROM analytics_usage_buckets WHERE kind='page_view'"))[0].n),2);
  runtime.recordPage('/login');await runtime.tick();
  assert.equal(Number((await query("SELECT sum(events) AS n FROM analytics_usage_buckets WHERE kind='page_view'"))[0].n),3,'An increment after a flush is not lost');
  const keys=await query("SELECT actor_key FROM analytics_usage_buckets WHERE role='student'");assert.match(keys[0].actor_key,/^[a-f0-9]{64}$/);assert.notEqual(keys[0].actor_key,'3');
  await runtime.stop();
  clock+=60000;const restarted=createAnalyticsRuntime({query,collect:async()=>snapshot(),env:{...env,ANALYTICS_COLLECTION_ENABLED:'false'},instance:'usage-a',boot:'another-boot',now:()=>clock});
  restarted.recordHttp(req,{statusCode:202});await restarted.tick();
  const report=await createAnalyticsReports(query,restarted).usage({hours:24});
  assert.equal(report.roles.find(row=>row.role==='student').active_accounts,1);
  assert.equal(report.daily.reduce((n,row)=>n+Number(row.runs),0),2);
  assert.equal(report.daily.reduce((n,row)=>n+Number(row.page_views),0),3);
  await restarted.stop();
 }finally{await runtime.stop();await db.close();}
});

test('history report APIs require the separate session; public events accept coarse routes only',async t=>{
 const {db,query}=await database();const runtime=createAnalyticsRuntime({query,collect:async()=>snapshot(),env,instance:'api-http',boot:'http-boot'});
 const app=Fastify();await app.register(analyticsRoutes,{prefix:'/api',query,runtime});await app.register(usageRoutes,{prefix:'/api',runtime,rateLimit:async()=>({allowed:true})});
 const base=await app.listen({host:'127.0.0.1',port:0});t.after(async()=>{await app.close();await runtime.stop();await db.close();});
 for(const path of ['history','usage','incidents','export?type=usage'])assert.equal((await fetch(`${base}/api/analytics/${path}`)).status,401);
 let response=await fetch(`${base}/api/usage/config`);assert.deepEqual(await response.json(),{enabled:true,mode:'aggregate-pageviews',browserIdentifiers:false});
 const event=async(route,origin=env.ANALYTICS_ORIGIN)=>fetch(`${base}/api/usage/events`,{method:'POST',headers:{origin,'x-coderank-usage':'1','content-type':'application/json'},body:JSON.stringify({route})});
 assert.equal((await event('/profile/private-username')).status,400);assert.equal((await event('/login','https://evil.example')).status,403);assert.equal((await event('/login')).status,202);
 await runtime.tick();
 response=await fetch(`${base}/api/analytics/session`,{method:'POST',headers:{origin:env.ANALYTICS_ORIGIN,'x-analytics-request':'1','content-type':'application/json'},body:JSON.stringify({password})});
 assert.equal(response.status,200);const cookie=response.headers.get('set-cookie').split(';')[0];
 response=await fetch(`${base}/api/analytics/collect`,{method:'POST',headers:{cookie,origin:'https://evil.example','x-analytics-request':'1','content-type':'application/json'},body:'{}'});assert.equal(response.status,403);
 response=await fetch(`${base}/api/analytics/collect`,{method:'POST',headers:{cookie,origin:env.ANALYTICS_ORIGIN,'x-analytics-request':'1','content-type':'application/json'},body:'{}'});assert.equal(response.status,200);assert.equal((await response.json()).lastError,null);
 for(const path of ['history','usage','incidents']){response=await fetch(`${base}/api/analytics/${path}`,{headers:{cookie}});assert.equal(response.status,200,path);}
 response=await fetch(`${base}/api/analytics/history?hours=999`,{headers:{cookie}});assert.equal(response.status,400);
 response=await fetch(`${base}/api/analytics/history?instance=bad%27instance`,{headers:{cookie}});assert.equal(response.status,400);
 response=await fetch(`${base}/api/analytics/export?type=usage`,{headers:{cookie}});assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/csv/);assert.match(response.headers.get('content-disposition'),/attachment/);assert.match(await response.text(),/page_views/);
 assert.equal((await query("SELECT count(*)::int AS n FROM analytics_access WHERE action='EXPORT'"))[0].n,1);
});

test('unknown observations and missing minutes cannot resolve an incident; retention preserves academic data',async()=>{
 const {db,query}=await database();
 try{
  const base=Date.now()-600000,condition={scope:'fleet',rule:'unit-condition',severity:'warning',message:'Controlled condition',bad:true};
  for(const offset of [0,1])await reconcileIncident(query,condition,new Date(base+offset*60000).toISOString());
  await reconcileIncident(query,{...condition,bad:false},new Date(base+2*60000).toISOString());
  await reconcileIncident(query,{...condition,bad:null},new Date(base+3*60000).toISOString());
  await reconcileIncident(query,{...condition,bad:false},new Date(base+6*60000).toISOString());
  assert.equal((await query('SELECT resolved_at FROM analytics_incidents'))[0].resolved_at,null);
  await reconcileIncident(query,{...condition,bad:false},new Date(base+7*60000).toISOString());
  assert.ok((await query('SELECT resolved_at FROM analytics_incidents'))[0].resolved_at);
  await db.exec("INSERT INTO users(id,name,email,password,role) VALUES(1,'Student','retention-student@example.test','unchanged','student'),(2,'Faculty','retention-faculty@example.test','unchanged','faculty'); INSERT INTO courses(id,course_code,name,semester) VALUES(1,'RET','Retention',1); INSERT INTO practicals(id,faculty_id,course_id,title) VALUES(1,2,1,'Keep this'); INSERT INTO practical_submissions(student_id,practical_id,code,language,status) VALUES(1,1,convert_to('keep source','UTF8'),'python','completed');");
  await query("INSERT INTO analytics_usage_buckets VALUES('old','boot',now()-interval '40 days','page_view','/login','guest','',1)");
  assert.equal((await retainAnalyticsHistory(query))[1].rows,1);assert.equal((await query('SELECT count(*)::int AS n FROM analytics_usage_buckets'))[0].n,1);
  await retainAnalyticsHistory(query,{apply:true});assert.equal((await query('SELECT count(*)::int AS n FROM analytics_usage_buckets'))[0].n,0);
  assert.equal((await query('SELECT count(*)::int AS n FROM practical_submissions'))[0].n,1);
 }finally{await db.close();}
});

test('route normalization and CSV exports exclude URL identifiers and neutralize formulas',()=>{
 assert.equal(usageRoute('/profile/alice?token=private'),'/profile');assert.equal(usageRoute('/student/code/practical_3'),'/student/code');assert.equal(usageRoute('/analytics'),null);
 const csv=csvReport([{field:'=HYPERLINK("https://example.test")',note:'safe,quoted'},{field:'  +SUM(1,2)',note:'line\nbreak'}]);
 assert.match(csv,/'=HYPERLINK/);assert.match(csv,/'  \+SUM/);assert.match(csv,/"safe,quoted"/);
 const off=createAnalyticsRuntime({query:async()=>[],collect:async()=>snapshot(),env:{}});assert.equal(off.recordPage('/login'),false);assert.equal(off.getState().usageEnabled,false);
});


test('usage buffering remains bounded and storage errors do not escape collection',async()=>{
 const runtime=createAnalyticsRuntime({query:async()=>{throw Error('private database connection detail');},collect:async()=>snapshot(),env,instance:'bounded',boot:'bounded-boot'});
 runtime.recordPage('/login');
 for(let id=1;id<=2001;id++)runtime.recordHttp({routeOptions:{url:'/api/auth/profile'},actor:{id,role:'student'}},{statusCode:200});
 assert.equal(runtime.getState().pendingUsageBuckets,2000);assert.equal(runtime.getState().droppedEvents,2);
 await runtime.tick();assert.match(runtime.getState().lastError,/persistence unavailable/);assert.ok(!JSON.stringify(runtime.getState()).includes('private database'));
 await runtime.stop();
});
