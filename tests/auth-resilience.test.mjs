import test, {mock} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {retryRead} from '../packages/database/src/read-retry.js';
import {signInRequest} from '../apps/web/src/lib/sign-in-request.js';

test('safe read retry has one budget and does not retry permission failures', async (t) => {
  // Control the retry budget independently of scheduling delays on busy CI hosts.
  let now=0;
  t.mock.method(performance,'now',()=>now);
  let calls=0;
  assert.deepEqual(await retryRead(async()=>{if(++calls<3)throw Object.assign(Error('refused'),{code:'ECONNREFUSED'});return [1];},{delayMs:1,budgetMs:100}),[1]);
  assert.equal(calls,3);
  calls=0;
  await assert.rejects(retryRead(async()=>{calls++;throw Object.assign(Error('denied'),{code:'42501'});},{delayMs:1}),/denied/);
  assert.equal(calls,1);
  calls=0;
  await assert.rejects(retryRead(async()=>{
    calls++;now=101;
    throw Object.assign(Error('budget exhausted'),{code:'ECONNREFUSED'});
  },{budgetMs:100,delayMs:1}),/budget exhausted/);
  assert.equal(calls,1,'An exhausted budget must not start another attempt');
  now=0;
  await assert.rejects(retryRead(()=>new Promise(()=>{}),{budgetMs:15}),/timed out/);
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
let rate={allowed:false,unavailable:true}, logins=0;
mock.module(new URL('../apps/api/src/middleware/rate-limiter.js',import.meta.url).href,{namedExports:{checkRateLimit:async()=>rate,closeRateLimiter:async()=>{}}});
mock.module(new URL('../apps/api/src/modules/auth/auth.service.js',import.meta.url).href,{namedExports:{AuthService:{login:async()=>{logins++;return {token:'test',user:{id:1}};}}}});
const {buildApp}=await import('../apps/api/src/app.js');
const app=buildApp();
await app.ready();
test('login fails closed on limiter outage, preserves 429 and only authenticates allowed requests',async(t)=>{
 t.after(async()=>await app.close());
 const inject=(body)=>app.inject({method:'POST',url:'/api/auth/login',payload:body,headers:{'content-type':'application/json'}});
 let res=await inject({email:'user@test.invalid',password:'test-only'});assert.equal(res.statusCode,503);assert.equal(res.headers['retry-after'],'5');assert.equal(logins,0);
 rate={allowed:false,retryAfter:17};res=await inject({email:'user@test.invalid',password:'test-only'});assert.equal(res.statusCode,429);assert.equal(res.headers['retry-after'],'17');assert.equal(logins,0);
 rate={allowed:true};res=await inject({email:'user@test.invalid',password:'test-only'});assert.equal(res.statusCode,200);assert.equal(logins,1);assert.equal(res.headers['cache-control'],'no-store');
});

test('timing headers accept only numeric durations and safe labels',async()=>{
 const {requestTiming}=await import('../packages/core/src/utils/request-timing.js');
 const timing=requestTiming();timing.record('lookup',12.345);timing.record('bad label;token',1);timing.record('bad_value',NaN);
 assert.equal(timing.header(),'lookup;dur=12.35');
});
