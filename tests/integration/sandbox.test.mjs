import test from 'node:test';
import assert from 'node:assert/strict';
import { Executor } from '../../packages/runner/src/Executor.js';
import { Sandbox } from '../../packages/runner/src/Sandbox.js';
import { dockerCommand } from '../../packages/runner/src/docker.js';
const programs = { python:'print(input())', javascript:"process.stdin.on('data', d => process.stdout.write(d))", c:'#include <stdio.h>\nint main(){char b[100];fgets(b,100,stdin);printf("%s",b);}', cpp:'#include <iostream>\n#include <string>\nint main(){std::string s;std::getline(std::cin,s);std::cout<<s;}', java:'public class Solution { public static void main(String[] args){ System.out.println(new java.util.Scanner(System.in).nextLine()); } }' };
for (const [language,code] of Object.entries(programs)) test(`${language} compiles and executes in a disposable container`,async()=>{
 const executor=new Executor(language,code,5000);
 try{const compile=await executor.compile();assert.equal(compile.success,true,compile.error);const result=await executor.runOneTestCase('hello\n','hello',1,0);assert.equal(result.passed,true,result.errorMessage);}finally{await executor.cleanup();}
});
test('real sandboxes cannot see another job workspace or write the image filesystem',async()=>{
 const a=new Sandbox(),b=new Sandbox();
 try{
 await a.script('echo secret >/app/private',1000);
 const r=await b.script('test ! -e /app/private && test ! -w /etc/passwd && test $(id -u) = 1000 && ! kill -STOP 1 2>/dev/null && echo isolated',1000);
 assert.equal(r.stdout.trim(),'isolated');
 }finally{await a.destroy();await b.destroy();}
});

test('C and JavaScript function problems execute through the sandbox runner',async()=>{
 const { runC,runJavaScript }=await import('../../packages/runner/src/languages.js');
 const problem={entry:{type:'class-method',className:'Solution',methodName:'fib'}};
 const testCases=[{args:[0],expected:0},{args:[7],expected:13}];
 const c=await runC({problem,testCases,code:'int fib(int n){int a=0,b=1;while(n--){int next=a+b;a=b;b=next;}return a;}'});
 assert.equal(c.status,'accepted',JSON.stringify(c));
 const js=await runJavaScript({problem,testCases,code:'class Solution { fib(n){let a=0,b=1;while(n--)[a,b]=[b,a+b];return a;} }'});
 assert.equal(js.status,'accepted',JSON.stringify(js));
});

test('real sandbox drops capabilities, excludes host sockets and disables external network', async () => {
 const sandbox=new Sandbox();
 try {
  const result=await sandbox.script(`set -e
test ! -e /var/run/docker.sock
test "$(awk '/CapEff:/{print $2}' /proc/self/status)" = 0000000000000000
test "$(awk '/NoNewPrivs:/{print $2}' /proc/self/status)" = 1
test "$(ls /sys/class/net)" = lo
echo confined
`,2000);
  assert.equal(result.stdout.trim(),'confined');
 } finally { await sandbox.destroy(); }
});

test('real timeout removes the container including detached child processes', async () => {
 const sandbox=new Sandbox();
 try {
  await assert.rejects(sandbox.script('setsid sleep 30 >/dev/null 2>&1 & wait',100),error=>error.code===124||error.code===137||error.killed);
  assert.equal(sandbox.destroyed,true);
  await assert.rejects(dockerCommand(['inspect',sandbox.name]),/Command failed/);
 } finally { await sandbox.destroy(); }
});

test('real sandbox expires without a worker cleanup call', async () => {
 const previous=process.env.JOB_TIMEOUT_MS;
 process.env.JOB_TIMEOUT_MS='1000';
 const sandbox=new Sandbox();
 if(previous===undefined) delete process.env.JOB_TIMEOUT_MS; else process.env.JOB_TIMEOUT_MS=previous;
 try {
  await sandbox.start();
  await new Promise(resolve=>setTimeout(resolve,2000));
  await assert.rejects(dockerCommand(['inspect',sandbox.name]),/Command failed/);
 } finally { await sandbox.destroy(); }
});

test('recovery drill kills owner then reaps only its expired deployment-scoped sandbox', {timeout:25000}, async () => {
 const {spawn}=await import('node:child_process');
 const {once}=await import('node:events');
 const {randomUUID}=await import('node:crypto');
 const {reapExpiredSandboxes}=await import('../../packages/runner/src/reaper.js');
 const root=new URL('../../',import.meta.url);
 const scope=`drill-${randomUUID()}`;
 const active=new Sandbox(undefined,{scope});
 const priorLifetime=process.env.JOB_TIMEOUT_MS;
 process.env.JOB_TIMEOUT_MS='3000';
 const unrelated=new Sandbox(undefined,{scope:`${scope}-other`});
 if(priorLifetime===undefined) delete process.env.JOB_TIMEOUT_MS; else process.env.JOB_TIMEOUT_MS=priorLifetime;
 const env={...process.env,JOB_TIMEOUT_MS:'3000',SANDBOX_SCOPE:scope};
 delete env.NODE_TEST_CONTEXT;
 const owner=spawn(process.execPath,['tests/fixtures/sandbox-owner.fixture.mjs'],{cwd:root,env,stdio:['ignore','pipe','pipe','ipc']});
 let orphanName;
 let ownerStderr='';owner.stderr.on('data',chunk=>{ownerStderr+=chunk});
 try {
  orphanName=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error(`Sandbox owner did not start: ${ownerStderr}`)),10000);
   owner.once('message',message=>{clearTimeout(timer);message.error?reject(Error(message.error)):resolve(message.name)});
   owner.once('error',error=>{clearTimeout(timer);reject(error)});
   owner.once('exit',code=>{clearTimeout(timer);reject(Error(`Sandbox owner exited (${code}): ${ownerStderr}`))});
  });
  await dockerCommand(['pause',orphanName]);
  // Freeze a separately scoped test sandbox too: it must survive even once stale.
  await unrelated.start();await dockerCommand(['pause',unrelated.name]);
  await active.start();
  const ownerClosed=once(owner,'close');owner.kill('SIGKILL');
  const [,signal]=await ownerClosed;assert.equal(signal,'SIGKILL');
  const orphan=JSON.parse((await dockerCommand(['inspect',orphanName])).stdout)[0];
  const other=JSON.parse((await dockerCommand(['inspect',unrelated.name])).stdout)[0];
  // Wait past both Docker start+bounded lifetime and default 5s reaper grace.
  const expiry=Math.max(Date.parse(orphan.State.StartedAt),Date.parse(other.State.StartedAt))+3000+5000+150;
  await new Promise(resolve=>setTimeout(resolve,Math.max(0,expiry-Date.now())));
  const dry=await reapExpiredSandboxes({scope,dryRun:true});
  assert.ok(dry.expired.includes(orphan.Id));assert.deepEqual(dry.removed,[]);
  await dockerCommand(['inspect',orphan.Id]);
  const result=await reapExpiredSandboxes({scope});
  assert.deepEqual(result.errors,[]);assert.ok(result.removed.includes(orphan.Id));
  await assert.rejects(dockerCommand(['inspect',orphan.Id]),/Command failed/);
  assert.equal(JSON.parse((await dockerCommand(['inspect',active.name])).stdout)[0].State.Running,true);
  assert.equal(JSON.parse((await dockerCommand(['inspect',unrelated.name])).stdout)[0].State.Paused,true);
 }finally{
  if(owner.exitCode===null&&owner.signalCode===null)owner.kill('SIGKILL');
  for(const name of [orphanName,unrelated.name,active.name].filter(Boolean)){
   await dockerCommand(['unpause',name]).catch(()=>{});
   await dockerCommand(['rm','-f',name]).catch(()=>{});
  }
 }
});
