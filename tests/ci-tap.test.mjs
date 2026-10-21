import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { verifyTap } from '../scripts/ci/verify-tap.mjs';
import { testConfiguration, captureTestProcess } from '../scripts/ci/run-tests.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const fixture='tests/fixtures/ci/protocol.fixture.mjs';
function protocol(mode, extra=[]) {
 const args=['--test','--test-reporter=tap',...extra,fixture];
 const fixtureEnv={...process.env,CODERANK_TAP_FIXTURE:mode};
 delete fixtureEnv.NODE_TEST_CONTEXT;
 const result=spawnSync(process.execPath,args,{cwd:root,env:fixtureEnv,encoding:'utf8',timeout:5000,maxBuffer:1024*1024});
 assert.ifError(result.error);
 return { tap:result.stdout, options:{exitCode:result.status,signal:result.signal,args,expectedFiles:[fixture]} };
}
for(const mode of ['pass','nested','siblings'])test(`strict TAP accepts complete actual Node ${mode} protocol`,()=>{
 const {tap,options}=protocol(mode);const result=verifyTap(tap,options);assert.equal(result.ok,true,result.errors.join('\n'));
});
for(const mode of ['empty','skip','todo','fail','cancel','only'])test(`strict TAP rejects actual Node ${mode} protocol`,()=>{
 const {tap,options}=protocol(mode);assert.equal(verifyTap(tap,options).ok,false);
});
test('strict TAP rejects an explicitly focused invocation even when Node reports all green',()=>{
 const {tap,options}=protocol('only',['--test-only']);assert.match(tap,/# fail 0/);assert.equal(verifyTap(tap,options).ok,false);
});
test('strict TAP rejects truncated, empty, forged count and plan streams',()=>{
 const {tap,options}=protocol('pass');
 for(const broken of ['',tap.split('1..1')[0],tap.replace('# tests 1','# tests 2'),tap.replace('1..1','1..2'),tap.replace('ok 1 -','ok 2 -'),tap.replace(/# duration_ms.*\n?$/,'')]) assert.equal(verifyTap(broken,options).ok,false,broken);
 assert.equal(verifyTap(tap,{...options,timedOut:true}).ok,false);
 assert.equal(verifyTap(tap,{...options,signal:'SIGKILL'}).ok,false);
 assert.equal(verifyTap(tap,{...options,exitCode:1}).ok,false);
});
test('strict test configurations cannot recurse into fixtures or forward caller filters',async()=>{
 const unit=await testConfiguration('unit');
 assert.ok(unit.files.includes('tests/ci-tap.test.mjs'));
 assert.ok(unit.files.every(file=>/^tests\/[^/]+\.test\.mjs$/.test(file)));
 assert.ok(unit.args.includes('--test-concurrency=2'));
 assert.ok(unit.args.includes('--test-timeout=30000'));
 const integration=await testConfiguration('integration');assert.equal(integration.files.length,5);
 assert.ok(!integration.files.some(file=>file.includes('neon')));
 assert.deepEqual((await testConfiguration('docker')).files,['tests/integration/sandbox.test.mjs']);
 await assert.rejects(testConfiguration('--test-only'));
});

test('strict subprocess hard deadline terminates a real hung Node test process',async()=>{
 const env={...process.env,CODERANK_TAP_FIXTURE:'hang'};delete env.NODE_TEST_CONTEXT;
 const result=await captureTestProcess(['--test','--test-reporter=tap',fixture],{timeoutMs:250,env});
 assert.equal(result.timedOut,true);assert.equal(result.signal,'SIGKILL');
 assert.equal(verifyTap(result.stdout,result).ok,false);
 await assert.rejects(captureTestProcess([],{timeoutMs:Infinity}),/deadline/);
});
