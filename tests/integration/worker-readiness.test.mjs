import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import Redis from 'ioredis';
import { Queue } from 'bullmq';
import { startExecutionHeartbeat,WORKER_KEY_PREFIX } from '../../apps/worker/src/heartbeat.js';
import { readExecutionWorkers } from '../../packages/queue/src/index.js';
test('real Redis readiness detects missing, paused, unhealthy and expired worker leases',async()=>{
 const connection={host:'127.0.0.1',port:Number(process.env.REDIS_PORT||6379),maxRetriesPerRequest:1};
 const queue=new Queue('readiness-test',{connection}),redis=new Redis(connection);await once(redis,'ready');
 let paused=false,docker=true,heartbeat;
 try{
 assert.equal((await readExecutionWorkers(queue)).healthy,false);
 heartbeat=startExecutionHeartbeat({opts:{concurrency:2},isRunning:()=>true,isPaused:()=>paused},{redis,checkDocker:async()=>({healthy:docker}),intervalMs:100000});
 await heartbeat.refresh();assert.equal((await readExecutionWorkers(queue)).healthy,true);
 paused=true;await heartbeat.refresh();assert.equal((await readExecutionWorkers(queue)).healthy,false);
 paused=false;docker=false;await heartbeat.refresh();assert.equal((await readExecutionWorkers(queue)).healthy,false);
 docker=true;await heartbeat.refresh();assert.equal((await readExecutionWorkers(queue,{now:Date.now()+31000})).healthy,false);
 await redis.del(WORKER_KEY_PREFIX+heartbeat.id);assert.equal((await readExecutionWorkers(queue)).healthy,false);
 await heartbeat.stop();assert.equal((await readExecutionWorkers(queue)).healthy,false);
 }finally{if(heartbeat)await heartbeat.stop();else redis.disconnect();await queue.close();}
});
