import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { requireAdmin } from '../../apps/api/src/middleware/authentication.js';
import { PGlite } from '@electric-sql/pglite';
import { migrate } from '../../packages/database/src/migrations.js';
import analyticsRoutes from '../../apps/api/src/modules/analytics/analytics.routes.js';
import { analyticsConfig, hashAnalyticsPassword, verifyAnalyticsPassword } from '../../apps/api/src/modules/analytics/auth.js';

const password='testpass';
const hash=await hashAnalyticsPassword(password);
process.env.ANALYTICS_PASSWORD_HASH=hash;
process.env.ANALYTICS_SESSION_SECRET='test-only-analytics-session-secret-at-least32';
process.env.ANALYTICS_ORIGIN='https://analytics.example';
const headers={origin:process.env.ANALYTICS_ORIGIN,'x-analytics-request':'1'};

test('analytics configuration and password verification fail closed',async()=>{
  assert.equal(await verifyAnalyticsPassword(password,hash),true);
  assert.equal(await verifyAnalyticsPassword('incorrect',hash),false);
  assert.equal(await verifyAnalyticsPassword('x'.repeat(513),hash),false);
  assert.throws(()=>analyticsConfig({}),/not configured/);
  for(const origin of ['http://public.example','https://user:password@analytics.example','https://analytics.example/path'])assert.throws(()=>analyticsConfig({...process.env,ANALYTICS_ORIGIN:origin}));
});

test('real analytics HTTP and PostgreSQL engine isolate sessions, filter data and revoke access',async t=>{
  const db=new PGlite();
  const query=async(q,p=[]) => (await db.query(q,p)).rows;
  await migrate({query,apply:m=>db.transaction(async tx=>{for(const statement of m.statements)await tx.exec(statement);await tx.query('INSERT INTO coderank_migrations(name,checksum) VALUES($1,$2)',[m.name,m.checksum]);})});
  await db.exec(`INSERT INTO users(id,name,email,password,role) VALUES(1,'Test Student','student@example.test','unrelated-password','student'),(2,'Test Faculty','faculty@example.test','unrelated-password','faculty');
    INSERT INTO courses(id,course_code,name,semester) VALUES(1,'CS101','Programming',1);
    INSERT INTO practicals(id,faculty_id,course_id,title,total_marks) VALUES(1,2,1,'First practical',10);
    INSERT INTO practical_submissions(id,student_id,practical_id,code,language,status,normalized_marks) VALUES(1,1,1,convert_to('print("private-source")','UTF8'),'python','completed',10);`);
  const app=Fastify();
  app.get('/api/real-admin-boundary',{onRequest:requireAdmin},async()=>({admin:true}));
  await app.register(analyticsRoutes,{prefix:'/api',query});
  const address=await app.listen({host:'127.0.0.1',port:0});
  t.after(async()=>{await app.close();await db.close();});
  const send=(path,options={})=>fetch(address+'/api/analytics'+path,{...options,headers:{...headers,...(options.body?{'content-type':'application/json'}:{}),...options.headers}});
  for(const path of ['/session','/overview','/submissions','/submissions/1','/progress','/access']) {
    const response=await send(path,{headers:{authorization:'Bearer normal-admin-token'}});
    assert.equal(response.status,401,path);assert.equal(response.headers.get('cache-control'),'private, no-store');
    assert.ok(!(await response.text()).includes('private-source'));
  }
  let response=await send('/session',{method:'POST',body:JSON.stringify({password}),headers:{origin:'https://evil.example'}});assert.equal(response.status,403);
  response=await send('/session',{method:'POST',body:JSON.stringify({password:'wrong'})});assert.equal(response.status,401);
  response=await send('/session',{method:'POST',body:JSON.stringify({password})});assert.equal(response.status,200);
  const setCookie=response.headers.get('set-cookie'),cookie=setCookie.split(';')[0];
  assert.match(setCookie,/HttpOnly/);assert.match(setCookie,/SameSite=Strict/);assert.match(setCookie,/Secure/);assert.match(setCookie,/Path=\/api\/analytics/);
  const adminResponse=await fetch(address+'/api/real-admin-boundary',{headers:{cookie}});assert.equal(adminResponse.status,401,'Analytics cookies do not grant admin access');
  const stored=(await query('SELECT * FROM analytics_sessions'))[0];assert.ok(!cookie.includes(stored.token_hash));
  response=await send('/submissions',{headers:{cookie}});assert.equal(response.status,200);
  const list=await response.json();assert.equal(list.total,1);assert.equal(list.rows[0].student,'Test Student');assert.equal(list.rows[0].code,undefined);
  response=await send('/submissions?language=python&search=First',{headers:{cookie}});assert.equal((await response.json()).total,1);
  response=await send('/submissions?search=%25',{headers:{cookie}});assert.equal((await response.json()).total,0,'LIKE wildcards are literal');
  response=await send('/submissions?language=invalid',{headers:{cookie}});assert.equal(response.status,400);
  response=await send('/submissions?page=0',{headers:{cookie}});assert.equal(response.status,400);
  response=await send('/submissions/1',{headers:{cookie}});assert.equal(response.status,200);assert.equal((await response.json()).code,'print("private-source")');
  assert.equal((await query("SELECT count(*)::int AS n FROM analytics_access WHERE action='VIEW_SUBMISSION'"))[0].n,1);
  response=await send('/submissions/999',{headers:{cookie}});assert.equal(response.status,404);
  response=await send('/progress',{headers:{cookie}});assert.equal(response.status,200);assert.equal((await response.json()).courses[0].participating_students,1);
  response=await send('/session',{method:'DELETE',headers:{cookie,origin:'https://evil.example'}});assert.equal(response.status,403);
  response=await send('/session',{method:'DELETE',headers:{cookie}});assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),/Max-Age=0/);
  response=await send('/session',{headers:{cookie}});assert.equal(response.status,401,'Server-side logout revokes the token');
  response=await send('/session',{method:'POST',body:JSON.stringify({password})});const idleCookie=response.headers.get('set-cookie').split(';')[0];
  await query("UPDATE analytics_sessions SET last_seen=now()-interval '16 minutes'");
  response=await send('/session',{headers:{cookie:idleCookie}});assert.equal(response.status,401,'Idle session expiry is server enforced');
  await query('DELETE FROM analytics_login_limits');
  response=await send('/session',{method:'POST',body:JSON.stringify({password})});const absoluteCookie=response.headers.get('set-cookie').split(';')[0];
  await query("UPDATE analytics_sessions SET expires_at=now()-interval '1 second'");
  response=await send('/session',{headers:{cookie:absoluteCookie}});assert.equal(response.status,401,'Absolute expiry is server enforced');
  response=await send('/session',{method:'POST',body:JSON.stringify({password})});const oldCookie=response.headers.get('set-cookie').split(';')[0];
  process.env.ANALYTICS_SESSION_SECRET+='rotated';
  response=await send('/session',{headers:{cookie:oldCookie}});assert.equal(response.status,401,'Secret rotation revokes sessions');
  const before=(await query('SELECT password FROM users WHERE id=1'))[0].password;assert.equal(before,'unrelated-password');
  response=await send('/session',{method:'POST',body:JSON.stringify({password})});
  for(let i=0;i<5;i++)response=await send('/session',{method:'POST',body:JSON.stringify({password:'wrong'})});
  assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),'60');
  assert.equal((await query('SELECT password FROM users WHERE id=1'))[0].password,before);
});
