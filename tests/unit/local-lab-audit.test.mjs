import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import matrix from '../../docs/architecture/local-lab-matrix.json' with { type:'json' };
import snapshot from '../../docs/architecture/local-lab-predecessors.json' with { type:'json' };
import { assessMatrix, assessPredecessors, assessHost, artifactHash, supportedCompose } from '../../scripts/ci/local-lab-audit.mjs';

test('local audit keeps actual merged ownership gaps visible and rejects omitted or empty move-map rows', () => {
  const errors = assessMatrix(matrix);
  for (const id of ['shared-client-styles','runner-grouping','sandbox-warm','test-lanes-batch']) assert.ok(errors.some(e=>e.startsWith(id+':')),id);
  const core = matrix.rows.find(row => row.id === 'core-facades');
  assert.equal(core.structuralState, 'implemented');
  assert.equal(core.functionalAcceptance, 'unverified');
  const regressed = structuredClone(matrix);
  regressed.rows.find(row => row.id === 'core-facades').structuralState = 'gap';
  assert.ok(assessMatrix(regressed).some(error => error.startsWith('core-facades:')));
  for (const change of [m=>m.rows.pop(),m=>m.rows.push(m.rows[0]),m=>m.runtimeRequirements.pop(),m=>{m.rows[0].paths=[];}]) {
    const value=structuredClone(matrix);change(value);
    assert.ok(assessMatrix(value).length > errors.length);
  }
});

test('closed predecessor issues and passing fast CI do not conceal skipped strict acceptance', () => {
  assert.ok(assessPredecessors(snapshot.predecessors).some(e=>e.includes('skipped')));
  assert.ok(assessPredecessors(snapshot.predecessors.slice(1)).some(e=>e.includes('exactly once')));
  // A new strict final-head run may supersede historical skipped gates; it must
  // still have every merged predecessor. This flag alone never issues a certificate.
  assert.deepEqual(assessPredecessors(snapshot.predecessors,true),[]);
  const rows=structuredClone(snapshot.predecessors);rows[0].merged=false;
  assert.ok(assessPredecessors(rows,true).length);
});

test('lab evidence rejects CI/loopback scope, wrong source/hardware, missing groups and pending commands', () => {
  const identity={commit:'a'.repeat(40),tree:'b'.repeat(40),hardwareHash:'c'.repeat(64)};
  const host={...identity,scope:'intended-local-lab',lanUrl:'http://192.168.1.10:3000',requirements:matrix.runtimeRequirements.map(r=>({id:r.id,status:'passed',exitCode:0,command:'synthetic fixture only',artifacts:[{path:'test-results/synthetic.json',sha256:'d'.repeat(64)}]}))};
  assert.deepEqual(assessHost(host,identity),[]);
  for (const mutate of [r=>{r.scope='ci';},r=>{r.commit='e'.repeat(40);},r=>{r.hardwareHash='f'.repeat(64);},r=>{r.lanUrl='http://localhost:3000';},r=>{r.lanUrl='http://user:password@192.168.1.10';},r=>r.requirements.pop(),r=>{r.requirements[0].exitCode=null;},r=>{r.requirements[0].artifacts=[];}]) {
    const value=structuredClone(host);mutate(value);assert.ok(assessHost(value,identity).length);
  }
  assert.ok(assessHost(null,identity).length);
});

test('audit hashes real nonempty test-owned artifacts and refuses tampering, traversal and escaping symlinks',async()=>{
  const root=await mkdtemp(join(tmpdir(),'coderank-lab-audit-'));
  try {
    await mkdir(join(root,'test-results'));
    await writeFile(join(root,'test-results/result.json'),'{}');
    const hash=await artifactHash('test-results/result.json',undefined,root);assert.match(hash,/^[a-f0-9]{64}$/);
    await assert.rejects(artifactHash('test-results/result.json','0'.repeat(64),root),/mismatch/);
    await writeFile(join(root,'test-results/empty.json'),'');
    await assert.rejects(artifactHash('test-results/empty.json',undefined,root),/Empty/);
    await assert.rejects(artifactHash('../outside',undefined,root),/inside test-results/);
    await writeFile(join(root,'outside'),'synthetic');
    await symlink(join(root,'outside'),join(root,'test-results/link'));
    await assert.rejects(artifactHash('test-results/link',undefined,root),/symlink escapes/);
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('supported Compose versions enforce overlay reset minimum without excluding later majors',()=>{
  for(const v of ['2.24.4','v2.24.10','2.25.0','3.0.0','10.0.0'])assert.equal(supportedCompose(v),true,v);
  for(const v of ['2.24.3','2.23.9','1.29.2','unknown'])assert.equal(supportedCompose(v),false,v);
});
