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
