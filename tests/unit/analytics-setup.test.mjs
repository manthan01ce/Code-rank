import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,writeFile,rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseEnv } from 'node:util';
import { PGlite } from '@electric-sql/pglite';
import { migrate } from '../../packages/database/src/migrations.js';
import { configureAnalytics } from '../../scripts/lib/analytics-setup.mjs';
import { checkAnalyticsReadiness } from '../../scripts/lib/analytics-readiness.mjs';
import { hashAnalyticsPassword,verifyAnalyticsPassword } from '../../apps/api/src/modules/analytics/auth.js';

const password='testpass',origin='http://localhost:3000';
test('local setup accepts an eight-character password and updates the effective root file without storing plaintext',async()=>{
 const root=await mkdtemp(join(tmpdir(),'analytics-setup-'));
 try{
  await writeFile(join(root,'.env'),"UNRELATED=base\n");
  await writeFile(join(root,'.env.local'),`DATABASE_URL=postgresql://local/test\nANALYTICS_USAGE_SECRET=${'a'.repeat(64)}\nANALYTICS_PASSWORD_HASH=old\nANALYTICS_COLLECTION_ENABLED=false\n`);
  const selected=await configureAnalytics({password,origin,recording:true,root});assert.equal(selected,join(root,'.env.local'));
  const bytes=await readFile(selected,'utf8'),env=parseEnv(bytes);assert.doesNotMatch(bytes,/testpass/);assert.equal(await verifyAnalyticsPassword(password,env.ANALYTICS_PASSWORD_HASH),true);assert.equal(await verifyAnalyticsPassword('incorrect',env.ANALYTICS_PASSWORD_HASH),false);
  assert.equal(env.ANALYTICS_USAGE_SECRET,'a'.repeat(64));assert.equal(env.DATABASE_URL,'postgresql://local/test');for(const flag of ['COLLECTION','USAGE','EXECUTION'])assert.equal(env[`ANALYTICS_${flag}_ENABLED`],'true');assert.equal(await readFile(join(root,'.env'),'utf8'),'UNRELATED=base\n');
  const secret=env.ANALYTICS_SESSION_SECRET;await configureAnalytics({password,origin,root});const rotated=parseEnv(await readFile(selected,'utf8'));assert.notEqual(rotated.ANALYTICS_SESSION_SECRET,secret);assert.equal(rotated.ANALYTICS_USAGE_SECRET,env.ANALYTICS_USAGE_SECRET);assert.equal(rotated.ANALYTICS_EXECUTION_ENABLED,'true');
  await assert.rejects(hashAnalyticsPassword('short'),/8 or more/);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('readiness diagnoses configuration and database errors without disclosing secrets or writing data',async()=>{
 const bad=await checkAnalyticsReadiness({env:{DATABASE_URL:'postgresql://secret-user:secret-password@private-host/db'},query:async()=>{throw Error('secret-password');}});
 assert.equal(bad.ready,false);assert.ok(bad.checks.some(x=>x.name==='access configuration'&&!x.ok));assert.ok(bad.checks.some(x=>x.name==='database schema/access'&&!x.ok));assert.doesNotMatch(JSON.stringify(bad),/secret-password|secret-user|private-host/);
 const absent=await checkAnalyticsReadiness({env:{},query:async()=>assert.fail('No database URL means no query')});assert.equal(absent.ready,false);
});

test('readiness validates real migrated schema, origin and usage key and detects removed analytics tables',async()=>{
 const db=new PGlite(),query=async(q,p=[]) => (await db.query(q,p)).rows;
 try{
  await migrate({query,apply:m=>db.transaction(async tx=>{for(const s of m.statements)await tx.exec(s);await tx.query('INSERT INTO coderank_migrations(name,checksum) VALUES($1,$2)',[m.name,m.checksum]);})});
  const env={DATABASE_URL:'postgresql://local/test',ANALYTICS_PASSWORD_HASH:await hashAnalyticsPassword(password),ANALYTICS_SESSION_SECRET:'s'.repeat(48),ANALYTICS_ORIGIN:origin,ANALYTICS_USAGE_ENABLED:'true',ANALYTICS_USAGE_SECRET:'a'.repeat(64)};
  assert.equal((await checkAnalyticsReadiness({env,query,origin})).ready,true);
  assert.equal((await checkAnalyticsReadiness({env,query,origin:'http://localhost:3002'})).ready,false);
  assert.equal((await checkAnalyticsReadiness({env:{...env,ANALYTICS_USAGE_SECRET:''},query})).ready,false);
  await query('DROP TABLE analytics_sessions');const damaged=await checkAnalyticsReadiness({env,query,origin});assert.equal(damaged.ready,false);assert.ok(damaged.checks.some(x=>x.name==='database schema/access'&&!x.ok));
 }finally{await db.close();}
});
