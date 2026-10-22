import test, {mock} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {retryRead} from '../packages/database/src/read-retry.js';
import {signInRequest} from '../apps/web/src/lib/sign-in-request.js';

test('safe read retry has one budget and does not retry permission failures', async () => {
  let calls=0;
  assert.deepEqual(await retryRead(async()=>{if(++calls<3)throw Object.assign(Error('refused'),{code:'ECONNREFUSED'});return [1];},{delayMs:1,budgetMs:100}),[1]);
  assert.equal(calls,3);
  calls=0;
  await assert.rejects(retryRead(async()=>{calls++;throw Object.assign(Error('denied'),{code:'42501'});},{delayMs:1}),/denied/);
  assert.equal(calls,1);
  const start=performance.now();
  await assert.rejects(retryRead(()=>new Promise(()=>{}),{budgetMs:15}),/timed out/);
  assert.ok(performance.now()-start<200);
});
test('sign in distinguishes outage and throttling and aborts a stalled request without replay',async()=>{
  await assert.rejects(signInRequest({}, {fetchImpl:async()=>Response.json({}, {status:503})}),/temporarily unavailable/);
  await assert.rejects(signInRequest({}, {fetchImpl:async()=>Response.json({}, {status:429,headers:{'Retry-After':'17'}})}),/17 seconds/);
  let calls=0;
  await assert.rejects(signInRequest({}, {timeoutMs:10,fetchImpl:async(_, {signal})=>{calls++;return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));}}),/timed out/);
  assert.equal(calls,1);
  const data={token:'test-only',user:{role:'student'}};
  assert.deepEqual(await signInRequest({}, {fetchImpl:async()=>Response.json(data)}),data);
});
registerHooks({resolve(specifier,context,next){
 if(specifier.startsWith('@/'))return next(new URL(`../apps/web/src/${specifier.slice(2)}.js`,import.meta.url).href,context);
 if(specifier==='next/server')return next('next/server.js',context);
 return next(specifier,context);
}});
let rate={allowed:false,unavailable:true}, logins=0;
mock.module(new URL('../apps/web/src/lib/queue/rateLimiter.js',import.meta.url).href,{namedExports:{checkRateLimit:async()=>rate}});
mock.module('@coderank/core/services/UserService',{namedExports:{UserService:{login:async()=>{logins++;return {token:'test',user:{id:1}};}}}});
const {POST}=await import('../apps/web/src/app/api/auth/login/route.js');
const request=()=>new Request('http://local/api/auth/login',{method:'POST',body:JSON.stringify({email:'user@test.invalid',password:'test-only'})});
test('login fails closed on limiter outage, preserves 429 and only authenticates allowed requests',async()=>{
 let res=await POST(request());assert.equal(res.status,503);assert.equal(res.headers.get('Retry-After'),'5');assert.equal(logins,0);
 rate={allowed:false,retryAfter:17};res=await POST(request());assert.equal(res.status,429);assert.equal(res.headers.get('Retry-After'),'17');assert.equal(logins,0);
 rate={allowed:true};res=await POST(request());assert.equal(res.status,200);assert.equal(logins,1);assert.equal(res.headers.get('Cache-Control'),'no-store');
});

test('timing headers accept only numeric durations and safe labels',async()=>{
 const {requestTiming}=await import('../packages/core/src/utils/request-timing.js');
 const timing=requestTiming();timing.record('lookup',12.345);timing.record('bad label;token',1);timing.record('bad_value',NaN);
 assert.equal(timing.header(),'lookup;dur=12.35');
});
