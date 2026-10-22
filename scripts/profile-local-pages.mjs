/** Local HTTP phase measurements. Does not create accounts or bypass authentication. */
import {spawn} from 'node:child_process';
import {mkdirSync, createWriteStream, writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
const root=process.cwd();
const out=path.resolve(root,process.env.PROFILE_OUTPUT || 'reports/auth-page-review-2026-10-22');
mkdirSync(out,{recursive:true});
const env={...process.env,PORT:'3000',HOSTNAME:'127.0.0.1',NEXT_TELEMETRY_DISABLED:'1',JWT_SECRET:process.env.JWT_SECRET || randomBytes(32).toString('hex')};
const children=[],streams=[];
const report={startedAt:new Date().toISOString(),commit:process.env.PROFILE_COMMIT || null,mode:'development',baseUrl:process.env.PROFILE_BASE_URL || 'http://127.0.0.1:3000',requests:[],limitations:['HTTP timing includes body download but not browser hydration, paint, LCP or interaction readiness.','Authenticated success paths require real database, Redis and valid fixtures.','No user accounts are created by this profiler.']};
function start(file,name){const log=createWriteStream(path.join(out,`${name}.log`));streams.push(log);const child=spawn(process.execPath,[file],{cwd:root,env,stdio:['ignore','pipe','pipe']});children.push(child);child.stdout.pipe(log);child.stderr.pipe(log);return child;}
async function measure(route,label,options={}){
 const begin=performance.now();let head;
 const row={route,label,method:options.method || 'GET'};
 try{
  const res=await fetch(report.baseUrl+route,{...options,redirect:'manual',signal:AbortSignal.timeout(18000)});
  head=performance.now();
  const body=await res.text();
  Object.assign(row,{status:res.status,ttfbMs:+(head-begin).toFixed(2),totalMs:+(performance.now()-begin).toFixed(2),bytes:Buffer.byteLength(body),contentType:res.headers.get('content-type'),redirect:res.headers.get('location'),renderError:/uv_resident_set_memory|next-error|NEXT_HTTP_ERROR_FALLBACK;500/.test(body)});
  if(route==='/api/health'){try{row.health=JSON.parse(body);}catch{}}
  if(route.startsWith('/api/')){try{const b=JSON.parse(body);if(b.error)row.error=b.error;}catch{}}
 }catch(error){Object.assign(row,{totalMs:+(performance.now()-begin).toFixed(2),error:error.message,ttfbMs:head?+(head-begin).toFixed(2):null});}
 report.requests.push(row);console.log(JSON.stringify(row));
}
try{
 if(!process.env.PROFILE_BASE_URL){
  const web=start('apps/web/server.js','web');start('apps/worker/src/index.js','worker');
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup exceeded 30 seconds')),30000);web.on('error',e=>{clearTimeout(timer);reject(e);});web.on('exit',code=>{clearTimeout(timer);reject(Error(`Web exited ${code}`));});web.stdout.on('data',chunk=>{if(chunk.toString().includes('Server ready')){clearTimeout(timer);resolve();}});});
 }
 await measure('/api/live','liveness');
 await measure('/api/health','readiness cold');
 await measure('/api/health','readiness cached');
 for(const route of ['/','/login','/signup','/student','/student/practicals','/faculty','/admin','/practice']){
  for(let i=0;i<3;i++)await measure(route,i===0?'first request in this process':`repeat ${i}`);
 }
 for(let i=0;i<2;i++)await measure('/api/auth/login',`valid-shaped sign-in attempt ${i+1}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'timing-probe@example.invalid',password:'non-account-test-password'})});
 await measure('/api/auth/login','invalid payload validation',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
 await measure('/api/users','account creation unauthenticated access check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Timing probe',email:'timing-probe@example.invalid',role:'student',extra_info:{division:'CE1'}})});
 await measure('/api/auth/signup','public signup API existence check',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
}catch(error){report.error=error.message;console.error(error.message);}
finally{
 for(const child of children)if(child.exitCode===null)child.kill('SIGTERM');
 await new Promise(resolve=>setTimeout(resolve,1000));
 for(const child of children)if(child.exitCode===null)child.kill('SIGKILL');
 for(const stream of streams)stream.end();
 report.finishedAt=new Date().toISOString();
 writeFileSync(path.join(out,'http-timings.json'),JSON.stringify(report,null,2));
 console.log(`Results saved to ${out}/http-timings.json`);
}
process.exitCode=report.error?1:0;
