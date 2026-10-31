// Isolated production browser measurement stack; only disposable loopback test DBs.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {mkdirSync,openSync,closeSync} from 'node:fs';
import {once} from 'node:events';
import pg from 'pg';
import {createPostgresClient} from '../packages/database/src/postgres.js';
import {migrate} from '../packages/database/src/migrations.js';
import {hashPassword} from '../packages/core/src/utils/auth.js';
import {checkDeployment} from './lib/deployment-readiness.mjs';
const target=new URL(process.env.TEST_DATABASE_URL || 'invalid:');
assert.ok(['postgres:','postgresql:'].includes(target.protocol)&&['127.0.0.1','localhost'].includes(target.hostname)&&target.pathname.endsWith('_test'),'Requires disposable loopback *_test database');
const name=`coderank_perf_${randomBytes(8).toString('hex')}`,dbUrl=new URL(target);dbUrl.pathname='/'+name;
const password=randomBytes(24).toString('hex'),base='http://127.0.0.1:3102';
const env={...process.env,NODE_ENV:'production',HOSTNAME:'127.0.0.1',PORT:'3102',DATABASE_DRIVER:'postgres',DATABASE_URL:dbUrl.href,DB_POOL_SIZE:'3',DB_QUERY_TIMEOUT_MS:'5000',JWT_SECRET:randomBytes(48).toString('hex'),REALTIME_URL:base,ALLOWED_ORIGIN:base,REALTIME_REDIS_ENABLED:'true',CLUSTER_ENABLED:'true',WEB_CONCURRENCY:'2',MAX_CONCURRENT_JOBS:'2',DISABLE_RATE_LIMIT:'false',BROWSER_BASE_URL:base,BROWSER_PERFORMANCE:'true',E2E_ADMIN_EMAIL:'admin@perf.test',E2E_ADMIN_PASSWORD:password};
const admin=new pg.Pool({connectionString:target.href,max:1,connectionTimeoutMillis:5000});admin.on('error',()=>{});
const children=[],fds=[];let sql,created=false;
mkdirSync('test-results/authenticated',{recursive:true});
function start(file,name){const fd=openSync(`test-results/authenticated/perf-${name}.log`,'w');fds.push(fd);const child=spawn(process.execPath,[file],{env,stdio:['ignore',fd,fd],detached:true});children.push(child);return child;}
async function stop(child){if(child.exitCode!==null||child.signalCode!==null)return;const exited=once(child,'exit');try{process.kill(-child.pid,'SIGTERM');}catch{}const timer=setTimeout(()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}},5000);try{await exited;}finally{clearTimeout(timer);}}
try{
 await admin.query(`CREATE DATABASE ${name}`);created=true;
 sql=createPostgresClient(dbUrl.href,{poolSize:2,timeoutMs:5000});
 await migrate({query:(text,values)=>sql.query(text,values),apply:m=>sql.transaction(tx=>[tx.query('SELECT pg_advisory_xact_lock(20401017,1)'),...m.statements.map(text=>tx.query(text)),tx.query('INSERT INTO coderank_migrations(name,checksum) VALUES($1,$2)',[m.name,m.checksum])])},new URL('../database/migrations/',import.meta.url));
 await sql.query("INSERT INTO users(name,email,password,role,status) VALUES('Timing Admin',$1,$2,'admin','active')",[env.E2E_ADMIN_EMAIL,await hashPassword(password)]);
 await sql.query("INSERT INTO departments(name,institute_name) VALUES('CI Department','CI Institute')");
 start('apps/web/cluster.js','web');start('apps/worker/src/index.js','worker');
 let ready=false;const deadline=Date.now()+60000;
 while(Date.now()<deadline){assert.ok(children.every(c=>c.exitCode===null&&c.signalCode===null),'Performance stack process exited');try{await checkDeployment(base);ready=true;break;}catch{}await new Promise(r=>setTimeout(r,500));}
 assert.ok(ready,'Real DB/Redis/runner readiness must pass before timing');
 const browser=spawnSync(process.execPath,['node_modules/@playwright/test/cli.js','test','--config=tests/browser/playwright.config.mjs','auth-performance.spec.mjs'],{env,stdio:'inherit',timeout:480000});
 assert.equal(browser.status,0,'Performance samples require successful browser workflows');
}finally{
 await Promise.allSettled(children.map(stop));for(const fd of fds)closeSync(fd);
 await sql?.close();if(created)await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);await admin.end();
}
