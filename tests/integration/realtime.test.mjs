import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as connect } from 'socket.io-client';
import { once } from 'node:events';
import { configureRealtimeAdapter } from '../../apps/web/src/lib/realtime-adapter.js';
import { attachRealtime } from '../../apps/web/src/lib/realtime.js';
process.env.JWT_SECRET='realtime-integration-secret';
const { generateToken,verifyToken }=await import('../../packages/core/src/utils/auth.js');
const { createServiceToken,verifyServiceToken }=await import('../../packages/core/src/security/service-token.js');
test('shared Redis adapter delivers authorized rooms across independent websocket servers',async()=>{
 const nodes=[],clients=[];
 try{
 for(let i=0;i<2;i++){
  const http=createServer(),io=new Server(http,{transports:['websocket']});
  const close=await configureRealtimeAdapter(io,{REALTIME_REDIS_ENABLED:'true',REDIS_PORT:process.env.REDIS_PORT||6379});
  io.use((socket,next)=>{socket.data.actor=verifyToken(socket.handshake.auth.token);socket.data.service=!!verifyServiceToken(socket.handshake.auth.serviceToken);next(socket.data.actor||socket.data.service?undefined:Error('Unauthorized'));});
  io.on('connection',socket=>attachRealtime(io,socket,{getJobStatus:async(_id,actor)=>{if(actor?.id!==1)throw Error('denied');return {id:'job'};},authorizePractical:async()=>{throw Error('denied');},authorizeCourse:async()=>{throw Error('denied');}}));
  http.listen(0,'127.0.0.1');await once(http,'listening');nodes.push({http,io,close,url:`http://127.0.0.1:${http.address().port}`});
 }
 const client=async(index,auth)=>{const c=connect(nodes[index].url,{auth,transports:['websocket'],forceNew:true,reconnection:false});clients.push(c);await Promise.race([once(c,'connect'),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Socket connect timeout')),3000);timer.unref();})]);return c;};
 const owner=await client(0,{token:generateToken({id:1,role:'student'})});
 const other=await client(1,{token:generateToken({id:2,role:'student'})});
 const service=await client(1,{serviceToken:createServiceToken()});
 assert.equal((await owner.timeout(2000).emitWithAck('watch_job','job')).ok,true);
 assert.equal((await other.timeout(2000).emitWithAck('watch_job','job')).ok,false);
 assert.equal((await other.timeout(2000).emitWithAck('worker_job_complete',{jobId:'job',result:{status:'accepted'}})).ok,false);
 let leaked=false;other.on('job_complete',()=>{leaked=true;});
 const result=once(owner,'job_complete');
 assert.equal((await service.timeout(2000).emitWithAck('worker_job_complete',{jobId:'job',result:{status:'accepted',cases:[{hidden:true,input:'secret',expected:'secret',passed:true}]}})).ok,true);
 const [payload]=await Promise.race([result,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Cross-server event timeout')),3000);timer.unref();})]);
 assert.equal(payload.jobId,'job');assert.equal(payload.cases[0].input,undefined);assert.equal(leaked,false);
 }finally{
 for(const c of clients)c.disconnect();
 await Promise.all(nodes.map(async n=>{await new Promise(resolve=>n.io.close(resolve));await n.close();}));
 }
});
