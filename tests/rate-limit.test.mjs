import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
mock.module('redis',{namedExports:{createClient:()=>({on(){},connect:async()=>{throw Error('offline')}})}});
const { checkRateLimit } = await import('../apps/web/src/lib/queue/rateLimiter.js');
test('authentication and execution limits fail closed during Redis outage',async()=>{
 for(const category of ['login','submit','run']) assert.equal((await checkRateLimit('test',category)).allowed,false);
});
