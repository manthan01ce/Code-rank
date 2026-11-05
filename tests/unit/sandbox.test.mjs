import test from 'node:test';
import assert from 'node:assert/strict';
import { Sandbox, jobLifetime } from '@coderank/runner/sandbox';
test('invalid lifetimes retain a finite deadline and all values stay bounded', () => {
 for (const value of ['invalid', '', 'Infinity', '-4', '0']) assert.equal(jobLifetime(value), 30000);
 assert.equal(jobLifetime('250'), 1000);
 assert.equal(jobLifetime('9999999'), 120000);
 assert.equal(jobLifetime('45000'), 45000);
});
test('each job has a separate, bounded container without network or host mounts',async()=>{
 const calls=[];const docker=async(args,options)=>{calls.push({args,options});return {stdout:'',stderr:''}};
 const a=new Sandbox(docker),b=new Sandbox(docker);assert.notEqual(a.name,b.name);
 await a.script('echo ok',1000);await a.destroy();await a.destroy();
 const args=calls[0].args;
 for(const flag of ['--rm','--read-only','--cap-drop','--security-opt','--memory','--memory-swap','--pids-limit','--cpus','--user','--init'])assert.ok(args.includes(flag));
 assert.equal(args[args.indexOf('--network')+1],'none');assert.ok(!args.includes('-v'));assert.ok(!args.includes('--volume'));
 assert.equal(args[args.indexOf('--user')+1],'0:0');
 const execute=calls.find(c=>c.args[0]==='exec').args;assert.equal(execute[execute.indexOf('--user')+1],'1000:1000');
 assert.equal(args.at(-2),'sleep');assert.ok(Number(args.at(-1))<=120);
 assert.equal(calls.filter(c=>c.args[0]==='rm').length,1);
 await assert.rejects(a.script('echo closed',1000),/closed/);
});
test('timeout destroys the container and detached children',async()=>{
 const calls=[];const s=new Sandbox(async args=>{calls.push(args);if(args[0]==='exec')throw Object.assign(Error('timeout'),{code:124});return {}});
 await assert.rejects(s.script('sleep 10',5));assert.deepEqual(calls.at(-1),['rm','-f',s.name]);
});
test('output overflow destroys the container rather than leaving runaway children', async () => {
 const calls=[];
 const sandbox=new Sandbox(async args=>{calls.push(args);if(args[0]==='exec')throw Object.assign(Error('too much output'),{code:'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'});return {}});
 await assert.rejects(sandbox.script('yes',1000),/too much output/);
 assert.deepEqual(calls.at(-1),['rm','-f',sandbox.name]);
});
test('legacy warm opt-ins fail before Docker allocation for every language', () => {
  const previous = process.env.USE_WARM_DAEMONS;
  try {
    for (const value of ['true', 'TRUE', '1', 'enabled']) {
      process.env.USE_WARM_DAEMONS = value;
      for (const language of ['python', 'c', 'cpp', 'java', 'javascript']) {
        assert.throws(() => new Sandbox(() => assert.fail('must not allocate Docker'), { language }),
          error => error.code === 'WARM_DAEMONS_RETIRED' && error.infrastructure === true);
      }
    }
  } finally {
    if (previous === undefined) delete process.env.USE_WARM_DAEMONS;
    else process.env.USE_WARM_DAEMONS = previous;
  }
});
test('unset or disabled warm configuration keeps distinct cold jobs for every language', () => {
  const previous = process.env.USE_WARM_DAEMONS;
  try {
    for (const value of [undefined, '', 'false', 'FALSE']) {
      if (value === undefined) delete process.env.USE_WARM_DAEMONS; else process.env.USE_WARM_DAEMONS = value;
      const names = new Set();
      for (const language of ['python', 'c', 'cpp', 'java', 'javascript']) {
        const sandbox = new Sandbox(undefined, { language });
        assert.equal(sandbox.isWarm, false); assert.match(sandbox.name, /^coderank-job-/);
        assert.ok(!names.has(sandbox.name)); names.add(sandbox.name);
      }
    }
  } finally {
    if (previous === undefined) delete process.env.USE_WARM_DAEMONS;
    else process.env.USE_WARM_DAEMONS = previous;
  }
});
