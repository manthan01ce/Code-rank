import test from 'node:test';
import assert from 'node:assert/strict';
import { startExecutionHeartbeat, WORKER_REGISTRY, WORKER_KEY_PREFIX } from '../apps/worker/src/heartbeat.js';

class FakeRedis {
  transactions = [];
  disconnected = false;
  on() {}
  multi() {
    const commands=[];
    const transaction={};
    for (const name of ['set','zadd','zremrangebyscore','del','zrem']) transaction[name]=(...args)=>{commands.push([name,...args]);return transaction};
    transaction.exec=async()=>{this.transactions.push(commands);return commands.map(()=>[null,'OK'])};
    return transaction;
  }
  disconnect() { this.disconnected=true; }
}
const log={error(){}};
const worker={isRunning:()=>true,isPaused:()=>false,opts:{concurrency:4}};

test('capability heartbeat publishes an expiring per-worker record after checking the image',async()=>{
 const redis=new FakeRedis();
 const heartbeat=startExecutionHeartbeat(worker,{redis,checkDocker:async()=>({healthy:true}),now:()=>1000,log});
 try {
  await heartbeat.refresh();
  const commands=redis.transactions[0];
  const record=JSON.parse(commands[0][2]);
  assert.deepEqual({...record,image:undefined},{id:heartbeat.id,healthy:true,checkedAt:1000,concurrency:4,image:undefined});
  assert.deepEqual(commands[0].slice(3),['EX',30]);
  assert.equal(commands[0][1],`${WORKER_KEY_PREFIX}${heartbeat.id}`);
  assert.deepEqual(commands[1],['zadd',WORKER_REGISTRY,31000,heartbeat.id]);
 }finally{await heartbeat.stop()}
 assert.equal(redis.disconnected,true);
 assert.deepEqual(redis.transactions.at(-1),[['del',`${WORKER_KEY_PREFIX}${heartbeat.id}`],['zrem',WORKER_REGISTRY,heartbeat.id]]);
});

test('missing image or paused worker is never advertised as healthy',async()=>{
 for(const [dockerHealthy,paused] of [[false,false],[true,true]]){
  const redis=new FakeRedis();
  const heartbeat=startExecutionHeartbeat({...worker,isPaused:()=>paused},{redis,checkDocker:async()=>({healthy:dockerHealthy}),log});
  try {await heartbeat.refresh();assert.equal(JSON.parse(redis.transactions[0][0][2]).healthy,false)}finally{await heartbeat.stop()}
 }
});

test('concurrent capability refreshes coalesce and shutdown prevents a late healthy publish',async()=>{
 let finishCheck;
 let checks=0;
 const redis=new FakeRedis();
 const heartbeat=startExecutionHeartbeat(worker,{redis,checkDocker:()=>{checks++;return new Promise(resolve=>{finishCheck=resolve})},log});
 const first=heartbeat.refresh();assert.equal(heartbeat.refresh(),first);assert.equal(checks,1);
 const stop=heartbeat.stop();assert.equal(heartbeat.stop(),stop);
 finishCheck({healthy:true});
 await stop;
 assert.ok(redis.transactions.every(commands=>commands.every(command=>command[0]!=='set')));
 await heartbeat.refresh();assert.equal(checks,1);
});

test('Docker or Redis failures do not refresh a healthy lease or reject background refresh',async()=>{
 const redis=new FakeRedis();
 const heartbeat=startExecutionHeartbeat(worker,{redis,checkDocker:async()=>{throw Error('Docker unavailable')},log});
 try {await heartbeat.refresh();assert.equal(redis.transactions.length,0)}finally{await heartbeat.stop()}
 const broken=new FakeRedis();broken.multi=()=>({set(){return this},zadd(){return this},zremrangebyscore(){return this},exec:async()=>[[Error('Redis failed'),null]]});
 const second=startExecutionHeartbeat(worker,{redis:broken,checkDocker:async()=>({healthy:true}),log});
 try {await assert.doesNotReject(second.refresh())}finally{await second.stop()}
});
