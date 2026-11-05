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
test('warm daemon skips docker run and destroy is a no-op for the shared container', async () => {
  const previous = process.env.USE_WARM_DAEMONS;
  process.env.USE_WARM_DAEMONS = 'true';
  try {
    const { dockerCommand } = await import('@coderank/runner/docker');
    // isWarm requires runDocker === dockerCommand (the imported singleton)
    const sandbox = new Sandbox(dockerCommand, { language: 'python' });
    assert.ok(sandbox.isWarm, 'isWarm must be true when USE_WARM_DAEMONS=true and language is set');
    assert.equal(sandbox.name, 'coderank-python-daemon', 'warm sandbox must use the fixed daemon name');
    // start() is a no-op for warm mode — no docker run should be issued
    // We verify by replacing runDocker after construction to intercept any calls
    const calls = [];
    sandbox.runDocker = async args => { calls.push(args); return { stdout: '', stderr: '' }; };
    await sandbox.start();
    assert.equal(calls.filter(a => a[0] === 'run').length, 0, 'warm start must not issue docker run');
    // destroy() must not remove the shared daemon container
    await sandbox.destroy();
    assert.equal(calls.filter(a => a[0] === 'rm').length, 0, 'warm destroy must not remove the daemon');
    assert.equal(sandbox.destroyed, true);
  } finally {
    if (previous === undefined) delete process.env.USE_WARM_DAEMONS;
    else process.env.USE_WARM_DAEMONS = previous;
  }
});
test('warm daemon falls back to ephemeral container when exec reports No such container', async () => {
  const previous = process.env.USE_WARM_DAEMONS;
  process.env.USE_WARM_DAEMONS = 'true';
  try {
    const { dockerCommand } = await import('@coderank/runner/docker');
    const sandbox = new Sandbox(dockerCommand, { language: 'cpp' });
    assert.ok(sandbox.isWarm);
    assert.equal(sandbox.name, 'coderank-cpp-daemon');
    let execCalls = 0;
    const calls = [];
    // Replace runDocker after construction to control the exec failure and retry
    sandbox.runDocker = async (args) => {
      calls.push(args);
      if (args[0] === 'exec' && execCalls++ === 0) {
        throw Object.assign(new Error('No such container: coderank-cpp-daemon'), { stderr: 'No such container: coderank-cpp-daemon' });
      }
      return { stdout: 'ok', stderr: '' };
    };
    const result = await sandbox.script('echo ok', 5000);
    assert.equal(result.stdout, 'ok');
    assert.equal(sandbox.isWarm, false, 'isWarm must be cleared after daemon miss');
    assert.match(sandbox.name, /^coderank-job-/, 'name must become a fresh UUID-based ephemeral name');
    assert.ok(calls.some(a => a[0] === 'run'), 'fallback must issue docker run for the ephemeral container');
  } finally {
    if (previous === undefined) delete process.env.USE_WARM_DAEMONS;
    else process.env.USE_WARM_DAEMONS = previous;
  }
});

