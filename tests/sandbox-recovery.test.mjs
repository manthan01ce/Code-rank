import test from 'node:test';
import assert from 'node:assert/strict';
import { expiredOwnedSandbox, reapExpiredSandboxes, startSandboxReaper } from '../packages/runner/src/reaper.js';
import { reapSandboxCommand } from '../scripts/reap-sandboxes.mjs';
import { Sandbox } from '../packages/runner/src/Sandbox.js';
const id='a'.repeat(64),otherId='b'.repeat(64);
const owner='12345678-1234-4123-8123-123456789012';
const created=1700000000000;
const scope='recovery-test';
const silent={info(){},error(){}};
function container(overrides={}) {
 return {Id:id,Name:`/coderank-job-${owner}`,Created:new Date(created).toISOString(),State:{Running:true,StartedAt:new Date(created).toISOString()},Config:{Labels:{'coderank.sandbox':'true','coderank.sandbox.version':'1','coderank.sandbox.scope':scope,'coderank.sandbox.owner':owner,'coderank.sandbox.created_at':String(created),'coderank.sandbox.expires_at':String(created+1000),'coderank.sandbox.lifetime_ms':'1000'}},...overrides};
}
const expired={scope,now:created+6000,graceMs:5000};
test('actual sandbox launch labels satisfy recovery ownership and bounded expiry checks',async()=>{
 const calls=[];
 const sandbox=new Sandbox(async args=>{calls.push(args);return {stdout:''}},{scope});
 await sandbox.start();
 const args=calls[0],labels={};
 for(let index=0;index<args.length;index++)if(args[index]==='--label'){
  const [key,...value]=args[index+1].split('=');labels[key]=value.join('=');
 }
 const launchedAt=Number(labels['coderank.sandbox.created_at']);
 const actual=container({Name:`/${sandbox.name}`,Created:new Date(launchedAt).toISOString(),State:{Running:true,StartedAt:new Date(launchedAt).toISOString()},Config:{Labels:labels}});
 const deadline=Number(labels['coderank.sandbox.expires_at'])+5000;
 assert.equal(expiredOwnedSandbox(actual,{scope,now:deadline-1,graceMs:5000}),false);
 assert.equal(expiredOwnedSandbox(actual,{scope,now:deadline,graceMs:5000}),true);
 await sandbox.destroy();
});
test('only exact managed scope and complete metadata establish sandbox ownership',()=>{
 assert.equal(expiredOwnedSandbox(container(),expired),true);
 for(const [key,value] of [['coderank.sandbox','false'],['coderank.sandbox.version','2'],['coderank.sandbox.scope','another-deployment'],['coderank.sandbox.owner','pid-123'],['coderank.sandbox.expires_at','0'],['coderank.sandbox.lifetime_ms','999999'],['coderank.sandbox.created_at','NaN']]){
  const candidate=container();candidate.Config.Labels[key]=value;assert.equal(expiredOwnedSandbox(candidate,expired),false,key);
 }
 assert.equal(expiredOwnedSandbox(container({Name:'/unrelated'}),expired),false);
 assert.equal(expiredOwnedSandbox(container({Id:'not-an-id'}),expired),false);
 assert.equal(expiredOwnedSandbox(container({Config:{Labels:{'coderank.sandbox':'true'}}}),expired),false);
 assert.equal(expiredOwnedSandbox(container({State:{Running:true}}),expired),false);
});
test('dead owner does not shorten a valid lifetime and Docker start delay is respected',()=>{
 assert.equal(expiredOwnedSandbox(container(),{...expired,now:created+5999}),false);
 const delayed=container({State:{Running:true,StartedAt:new Date(created+30000).toISOString()}});
 assert.equal(expiredOwnedSandbox(delayed,expired),false);
 assert.equal(expiredOwnedSandbox(delayed,{...expired,now:created+36000}),true);
});
test('reaper inspects exact immutable IDs and removes only verified stale owned containers',async()=>{
 const calls=[];
 const docker=async args=>{calls.push(args);if(args[0]==='ps')return {stdout:`${id}\n${otherId}\nmalformed-id\n`};if(args[0]==='inspect')return {stdout:JSON.stringify([container(args.at(-1)===otherId?{Id:otherId,Config:{Labels:{'coderank.sandbox':'false'}}}:{})])};return {stdout:''}};
 const result=await reapExpiredSandboxes({scope,runDocker:docker,now:()=>expired.now});
 assert.deepEqual(result.removed,[id]);assert.deepEqual(result.retained,[otherId]);assert.equal(result.inspected,2);
 assert.deepEqual(calls.filter(args=>args[0]==='rm'),[['rm','-f',id]]);
 assert.ok(calls[0].includes('label=coderank.sandbox.scope=recovery-test'));
});
test('dry run cannot remove a sandbox and inspected identity mismatch fails closed',async()=>{
 const calls=[];
 const docker=async args=>{calls.push(args);return {stdout:args[0]==='ps'?id:JSON.stringify([container()])}};
 const report=await reapExpiredSandboxes({scope,runDocker:docker,now:()=>expired.now,dryRun:true});
 assert.deepEqual(report.expired,[id]);assert.deepEqual(report.removed,[]);assert.ok(calls.every(args=>args[0]!=='rm'));
 calls.length=0;
 await reapExpiredSandboxes({scope,runDocker:async args=>{calls.push(args);return {stdout:args[0]==='ps'?otherId:JSON.stringify([container()])}},now:()=>expired.now});
 assert.ok(calls.every(args=>args[0]!=='rm'));
});
test('Docker disappearance is safe, other inspect failures are reported without removing anything',async()=>{
 for(const stderr of ['Error: No such object: gone','Docker daemon unavailable']){
  const calls=[];
  const report=await reapExpiredSandboxes({scope,runDocker:async args=>{calls.push(args);if(args[0]==='ps')return {stdout:id};throw Object.assign(Error(stderr),{stderr})}});
  assert.equal(report.errors.length,stderr.includes('No such')?0:1);assert.ok(calls.every(args=>args[0]!=='rm'));
 }
});
test('bounded batches advance a cursor beyond active sandboxes',async()=>{
 const calls=[];
 const report=await reapExpiredSandboxes({scope,limit:1,cursor:1,now:()=>expired.now,runDocker:async args=>{calls.push(args);return {stdout:args[0]==='ps'?`${id}\n${otherId}`:JSON.stringify([container({Id:otherId})])}}});
 assert.equal(report.inspected,1);assert.equal(report.nextCursor,0);assert.deepEqual(report.removed,[otherId]);
 await assert.rejects(reapExpiredSandboxes({scope:'bad scope'}),/scope/i);
 await assert.rejects(reapExpiredSandboxes({scope,graceMs:-1}),/limits/);
});
test('recovery loop coalesces scans and stops before a later interval can run',async()=>{
 let finish;
 const calls=[];
 const recovery=startSandboxReaper({scope,log:silent,runDocker:async args=>{calls.push(args);return new Promise(resolve=>{finish=resolve})}});
 const first=recovery.refresh();assert.equal(recovery.refresh(),first);
 const stop=recovery.stop();assert.equal(recovery.stop(),stop);
 finish({stdout:''});await stop;await recovery.refresh();assert.equal(calls.length,1);
});
test('recovery CLI requires explicit deployment scope and defaults to dry-run',async()=>{
 const calls=[];const reap=async options=>{calls.push(options);return {errors:[]}};
 await reapSandboxCommand(['--scope',scope],reap);await reapSandboxCommand(['--scope',scope,'--apply'],reap);
 assert.deepEqual(calls,[{scope,dryRun:true},{scope,dryRun:false}]);
 await assert.rejects(reapSandboxCommand([],reap),/scope/);
 await assert.rejects(reapSandboxCommand(['--scope',scope,'--all'],reap),/Usage/);
});
