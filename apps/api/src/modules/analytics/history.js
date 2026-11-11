import { usageRoutes } from '@coderank/contracts/usage';
import { createHmac,randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { withTimeout } from '@coderank/core/shared/timeout';
import { retainAnalyticsHistory } from './retention.js';
import { analyticsConfig } from './auth.js';

const finite=value=>Number.isFinite(Number(value))&&value!==null&&value!==undefined?Number(value):null;
const minute=value=>new Date(Math.floor(value/60000)*60000).toISOString();
export function analyticsConditions(snapshot,sample) {
 const measured=snapshot.execution?.status==='measured';
 return [
  {rule:'database_readiness',scope:'fleet',severity:'critical',message:'Database readiness is not healthy.',bad:snapshot.database?.healthy!==true},
  {rule:'queue_unavailable',scope:'fleet',severity:'critical',message:'Execution queue telemetry is unavailable.',bad:!measured},
  {rule:'workers_offline',scope:'fleet',severity:'critical',message:'No healthy execution workers are reporting.',bad:measured?snapshot.execution.healthyWorkers===0:null},
  {rule:'queue_delay',scope:'fleet',severity:'warning',message:'Oldest waiting execution exceeds 30 seconds.',bad:measured?Number(snapshot.execution.queue?.oldestWaitingMs)>30000:null},
  {rule:'api_error_rate',scope:'instance',severity:'critical',message:'API server errors exceed 5% of at least 20 requests in a sampling window.',bad:sample.errorRate===null?null:sample.windowRequests>=20?sample.errorRate>0.05:false},
  {rule:'event_loop_delay',scope:'instance',severity:'warning',message:'API process event-loop P95 delay exceeds 100 ms.',bad:finite(snapshot.http?.process?.eventLoopDelayMs?.p95)===null?null:snapshot.http.process.eventLoopDelayMs.p95>100},
 ];
}

export async function reconcileIncident(query,condition,bucket) {
 const status=condition.bad===null?'unknown':condition.bad?'bad':'good';
 const [state]=await query(`INSERT INTO analytics_rule_state(scope,rule,bad_streak,good_streak,bad_since,last_bucket,status)
 VALUES($1,$2,$3,$4,CASE WHEN $3=1 THEN $5::timestamptz ELSE NULL END,$5,$6)
 ON CONFLICT(scope,rule) DO UPDATE SET
 bad_streak=CASE WHEN $6='bad' THEN CASE WHEN analytics_rule_state.last_bucket>=$5::timestamptz-interval '90 seconds' THEN analytics_rule_state.bad_streak+1 ELSE 1 END ELSE 0 END,
 good_streak=CASE WHEN $6='good' THEN CASE WHEN analytics_rule_state.last_bucket>=$5::timestamptz-interval '90 seconds' THEN analytics_rule_state.good_streak+1 ELSE 1 END ELSE 0 END,
 bad_since=CASE WHEN $6='bad' THEN CASE WHEN analytics_rule_state.last_bucket>=$5::timestamptz-interval '90 seconds' THEN COALESCE(analytics_rule_state.bad_since,$5::timestamptz) ELSE $5::timestamptz END ELSE NULL END,
 last_bucket=$5,status=$6 WHERE analytics_rule_state.last_bucket<$5::timestamptz RETURNING *`,[condition.scope,condition.rule,status==='bad'?1:0,status==='good'?1:0,bucket,status]);
 if(!state)return;
 if(state.bad_streak>=2)await query(`INSERT INTO analytics_incidents(scope,rule,severity,message,opened_at,confirmed_at,last_seen_at)
 VALUES($1,$2,$3,$4,$5,$6,$6) ON CONFLICT(scope,rule) WHERE resolved_at IS NULL DO UPDATE SET last_seen_at=EXCLUDED.last_seen_at`,[condition.scope,condition.rule,condition.severity,condition.message,state.bad_since,bucket]);
 if(state.good_streak>=2)await query('UPDATE analytics_incidents SET resolved_at=$3 WHERE scope=$1 AND rule=$2 AND resolved_at IS NULL',[condition.scope,condition.rule,bucket]);
}

export function createAnalyticsRuntime({query,collect,env=process.env,now=Date.now,cpu=()=>process.cpuUsage(),instance=env.ANALYTICS_INSTANCE_ID || hostname(),boot=randomUUID()}={}) {
 let deadline=0;
 const originalQuery=query;query=(text,params)=>{const remaining=deadline?Math.min(5000,deadline-Date.now()):5000;if(remaining<=0)throw Error('Collection deadline exceeded');return withTimeout(originalQuery(text,params),remaining);};
 const instanceId=/^[a-zA-Z0-9_.-]{1,64}$/.test(instance)?instance:`api-${boot.slice(0,8)}`;
 const rows=new Map();let timer,pending,stopped=false,previous=null,usageSecret,settings;
 const state={instanceId,bootId:boot,collectionEnabled:false,usageEnabled:false,lastAttempt:null,lastSuccess:null,lastError:null,droppedEvents:0};
 function configure(){
  const history=env.ANALYTICS_COLLECTION_ENABLED==='true',usage=env.ANALYTICS_USAGE_ENABLED==='true';
  if(!history&&!usage)return;
  try{
   const config=analyticsConfig(env);
   if(usage&&!/^[a-f0-9]{64}$/.test(env.ANALYTICS_USAGE_SECRET || ''))throw Error('Usage secret missing');
   settings=config;usageSecret=env.ANALYTICS_USAGE_SECRET;state.collectionEnabled=history;state.usageEnabled=usage;
  }catch{state.lastError='Analytics collection configuration is incomplete.';}
 }
 configure();
 function add(kind,route,actor){
  if(!state.usageEnabled||stopped)return false;
  const valid=actor&&['admin','faculty','student'].includes(actor.role)&&Number.isSafeInteger(Number(actor.id))&&Number(actor.id)>0;
  const role=valid?actor.role:'guest',actorKey=valid?createHmac('sha256',usageSecret).update(`${role}:${actor.id}`).digest('hex'):'';
  const bucket=minute(now()),key=JSON.stringify([bucket,kind,route,role,actorKey]);
  if(!rows.has(key)&&rows.size>=2000){state.droppedEvents++;return false;}
  const row=rows.get(key)||{instance_id:instanceId,boot_id:boot,bucket,kind,route,role,actor_key:actorKey,events:0};
  row.events++;rows.set(key,row);return true;
 }
 async function flush(){
  if(!rows.size)return;
  const batch=[...rows.values()].slice(0,2000).map(row=>({...row}));
  await query(`INSERT INTO analytics_usage_buckets(instance_id,boot_id,bucket,kind,route,role,actor_key,events)
   SELECT instance_id,boot_id,bucket,kind,route,role,actor_key,events FROM jsonb_to_recordset($1::jsonb)
   AS x(instance_id text,boot_id text,bucket timestamptz,kind text,route text,role text,actor_key text,events bigint)
   ON CONFLICT(instance_id,boot_id,bucket,kind,route,role,actor_key) DO UPDATE SET events=GREATEST(analytics_usage_buckets.events,EXCLUDED.events)`,[JSON.stringify(batch)]);
  for(const row of batch){const key=JSON.stringify([row.bucket,row.kind,row.route,row.role,row.actor_key]);if(row.bucket<minute(now())&&rows.get(key)?.events===row.events)rows.delete(key);}
 }
 async function sample(){
  const snapshot=await collect(),observed=now(),currentCpu=cpu();
  const elapsed=previous?observed-previous.at:0;
  const requestTotal=Number(snapshot.http.requests),errorTotal=Number(snapshot.http.errors);
  const windowRequests=previous&&requestTotal>=previous.requests?requestTotal-previous.requests:null;
  const windowErrors=previous&&errorTotal>=previous.errors?errorTotal-previous.errors:null;
  const sample={windowRequests,errorRate:windowRequests>0&&windowErrors!==null?windowErrors/windowRequests:windowRequests===0&&windowErrors===0?0:null};
  const requestRate=windowRequests!==null&&elapsed>0?windowRequests/(elapsed/1000):null;
  const cpuPercent=previous&&elapsed>0?((currentCpu.user-previous.cpu.user)+(currentCpu.system-previous.cpu.system))/elapsed/10:null;
  const measured=snapshot.execution?.status==='measured',execution=snapshot.execution;
  const workers=measured?(execution.workers||[]).map(w=>({id:w.id,healthy:w.healthy,fresh:w.fresh,rssBytes:finite(w.process?.rssBytes),cpuPercent:finite(w.process?.cpuPercentOfOneCore),occupied:w.occupied,available:w.available,containers:w.containers?.running??null})):[];
  const bucket=minute(observed);
  const result=await query(`INSERT INTO analytics_samples(instance_id,boot_id,bucket,observed_at,release,requests_total,errors_total,request_rate,error_rate,latency_p95_ms,rss_bytes,cpu_percent,queue_waiting,queue_active,available_slots,occupied_slots,healthy_workers,database_healthy,execution_status,workers)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb)
   ON CONFLICT(instance_id,boot_id,bucket) DO NOTHING RETURNING id`,[instanceId,boot,bucket,new Date(observed).toISOString(),String(env.ANALYTICS_RELEASE || 'unknown').slice(0,80),requestTotal,errorTotal,requestRate,sample.errorRate,requestTotal>0?finite(snapshot.http.latencyMs?.p95):null,finite(snapshot.http.process?.memory?.rss),cpuPercent,measured?finite(execution.queue?.waiting):null,measured?finite(execution.queue?.active):null,measured?execution.availableSlots:null,measured?execution.occupiedSlots:null,measured?execution.healthyWorkers:null,snapshot.database?.healthy??null,measured?'measured':'unavailable',JSON.stringify(workers)]);
  if(!result.length)return;
  previous={at:observed,requests:requestTotal,errors:errorTotal,cpu:currentCpu};
  const [lease]=await query(`INSERT INTO analytics_collector_leases(name,owner,expires_at) VALUES('fleet',$1,now()+interval '2 minutes')
   ON CONFLICT(name) DO UPDATE SET owner=EXCLUDED.owner,expires_at=EXCLUDED.expires_at
   WHERE analytics_collector_leases.expires_at<=now() OR analytics_collector_leases.owner=EXCLUDED.owner RETURNING owner`,[boot]);
  for(const condition of analyticsConditions(snapshot,sample)){
   if(condition.scope==='fleet'&&!lease)continue;
   await reconcileIncident(query,{...condition,scope:condition.scope==='fleet'?'fleet':`instance:${instanceId}`},bucket);
  }
 }
 const runtime={
  instanceId,bootId:boot,
  getState:()=>({...state,pendingUsageBuckets:rows.size,origin:settings?.origin || null}),
  recordPage:route=>usageRoutes.includes(route)&&add('page_view',route,null),
  recordHttp(request,reply){
   if(!state.usageEnabled||reply.statusCode<200||reply.statusCode>=400)return;
   const route=request.routeOptions.url || '/unmatched';
   if(route.startsWith('/api/analytics')||route.startsWith('/api/usage')||['/api/live','/api/health','/api/health/detailed','/api/metrics','/api/queue/stats'].includes(route)||route.length>160)return;
   const actor=request.analyticsActor || request.actor;
   add('api_request',route,actor);
   if(reply.statusCode===202&&['run_accepted','submit_accepted'].includes(request.analyticsAction))add(request.analyticsAction,route,actor);
  },
  tick(){
   if(stopped||(!state.collectionEnabled&&!state.usageEnabled))return Promise.resolve();
   if(pending)return pending;
   state.lastAttempt=new Date(now()).toISOString();deadline=Date.now()+8000;
   pending=(async()=>{
    try{await flush();if(state.collectionEnabled)await sample();await retainAnalyticsHistory(query,{apply:true});state.lastSuccess=new Date(now()).toISOString();state.lastError=null;}
    catch{state.lastError='Analytics persistence unavailable; history may have gaps.';}
   })().finally(()=>{pending=null;deadline=0;});return pending;
  },
  start(){if(timer||stopped||(!state.collectionEnabled&&!state.usageEnabled))return;timer=setInterval(()=>{void runtime.tick();},60000);timer.unref();void runtime.tick();},
  async stop(){stopped=true;clearInterval(timer);await pending;try{await flush();if(state.collectionEnabled)await query('DELETE FROM analytics_collector_leases WHERE owner=$1',[boot]);}catch{state.lastError='Final analytics flush or lease release could not be confirmed.';}},
 };
 return runtime;
}
