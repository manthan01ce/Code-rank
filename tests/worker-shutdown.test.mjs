import test from 'node:test';
import assert from 'node:assert/strict';
import { createShutdown } from '../apps/worker/src/shutdown.js';
const silent = { info() {}, error() {} };
test('shutdown stops intake before draining and disconnects once across repeated signals', async () => {
 const events=[];
 const workers=[0,1].map(id=>({pause:async local=>{assert.equal(local,true);events.push(`pause${id}`)},close:async()=>{assert.ok(events.includes('pause0')&&events.includes('pause1'));events.push(`close${id}`)}}));
 const shutdown=createShutdown({workers,socket:{disconnect:()=>events.push('disconnect')},log:silent});
 const first=shutdown();assert.equal(shutdown(),first);assert.equal(await first,0);
 assert.deepEqual(events,['pause0','pause1','close0','close1','disconnect']);
});
test('shutdown deadline includes a Redis pause that never resolves', async () => {
 let disconnected=0;
 const shutdown=createShutdown({workers:[{pause:()=>new Promise(()=>{}),close:async()=>assert.fail('must not close before pause')}],socket:{disconnect:()=>disconnected++},graceMs:15,log:silent});
 assert.equal(await shutdown(),1);assert.equal(disconnected,1);
});
test('shutdown deadline includes active work that never drains', async () => {
 const shutdown=createShutdown({workers:[{pause:async()=>{},close:()=>new Promise(()=>{})}],socket:{disconnect(){}},graceMs:15,log:silent});
 assert.equal(await shutdown(),1);
});
test('shutdown handles Redis errors and disconnects the realtime client', async () => {
 let disconnected=false;
 const shutdown=createShutdown({workers:[{pause:async()=>{throw Error('Redis unavailable')}}],socket:{disconnect:()=>{disconnected=true}},log:silent});
 assert.equal(await shutdown(),1);assert.equal(disconnected,true);
});
