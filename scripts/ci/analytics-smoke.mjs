// Real PostgreSQL + Redis + API + production web + Chromium; no intercepted requests.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir,writeFile } from 'node:fs/promises';
import { reconcileIncident } from '../../apps/api/src/modules/analytics/history.js';
import { webEnvironment } from '../lib/web-environment.mjs';
import { chromium } from '@playwright/test';
import sql,{closeDatabase} from '@coderank/database';
import { createExecutionQueue } from '@coderank/queue';
import { createProxy,createApiGateway } from '../../infrastructure/gateway/proxy.mjs';

const base='http://127.0.0.1:3311',out='test-results/analytics';
assert.equal(process.env.CI,'true','Run this smoke suite only in isolated CI');
assert.match(new URL(process.env.DATABASE_URL).pathname,/_test$/,'Use an isolated test database');
assert.equal(process.env.ANALYTICS_ORIGIN,base);
await mkdir(out,{recursive:true});
let browser,gateway;const children=[],logs=[];
const launch=(args,env=process.env)=>{const child=spawn(process.execPath,args,{env,stdio:['ignore','pipe','pipe']});children.push(child);child.stdout.on('data',chunk=>logs.push(String(chunk)));child.stderr.on('data',chunk=>logs.push(String(chunk)));return child;};
const queue=createExecutionQueue({host:process.env.REDIS_HOST||'127.0.0.1',port:Number(process.env.REDIS_PORT||6379),maxRetriesPerRequest:1});
let queued,apiChild;const extraJobs=[];
const apiEnvironment={...process.env,ANALYTICS_COLLECTION_ENABLED:'true',ANALYTICS_USAGE_ENABLED:'true'};
try{
  const [student]=await sql.query("INSERT INTO users(name,email,password,role) VALUES('Analytics CI Student','analytics-student@ci.example','unused-test-only-hash','student') RETURNING id",[]);
  const [faculty]=await sql.query("INSERT INTO users(name,email,password,role) VALUES('Analytics CI Faculty','analytics-faculty@ci.example','unused-test-only-hash','faculty') RETURNING id",[]);
  const [course]=await sql.query("INSERT INTO courses(course_code,name,semester) VALUES('AN-CI','Analytics verification',1) RETURNING id",[]);
  const [practical]=await sql.query("INSERT INTO practicals(faculty_id,course_id,title,total_marks) VALUES($1,$2,'Analytics CI practical',10) RETURNING id",[faculty.id,course.id]);
  await sql.query("INSERT INTO practical_submissions(student_id,practical_id,code,language,status,normalized_marks) VALUES($1,$2,convert_to($3,'UTF8'),'python','completed',10)",[student.id,practical.id,'print("analytics-ci-source")']);
  await sql.query("INSERT INTO submission_attempts(job_id,student_id,practical_id,code,language,normalized_marks,raw_marks,case_results,result,submitted_at) VALUES('analytics-ci-job',$1,$2,convert_to($3,'UTF8'),'python',10,10,'[]','{}',now())",[student.id,practical.id,'print("analytics-ci-source")']);
  queued=await queue.add('analytics-ci',{type:'practice',userId:student.id,payload:{language:'python',code:'print(1)'}});
  apiChild=launch(['apps/api/src/server.js'],apiEnvironment);
  launch(['node_modules/next/dist/bin/next','start','apps/web','-H','127.0.0.1','-p','3313'],webEnvironment(process.env,{port:3313,production:true}));
  const api=createApiGateway({origin:'http://127.0.0.1:3312'}),web=createProxy({match:()=>true,origin:'http://127.0.0.1:3313'});
  gateway=http.createServer((req,res)=>{if(!api(req,res))web(req,res);});
  await new Promise(resolve=>gateway.listen(3311,'127.0.0.1',resolve));
  let ready=false;
  for(let i=0;i<80;i++){
    assert.ok(children.every(child=>child.exitCode===null),'Services must stay running');
    try{ready=(await fetch(`${base}/analytics`,{signal:AbortSignal.timeout(1000)})).ok&&(await fetch(`${base}/api/live`,{signal:AbortSignal.timeout(1000)})).ok;}catch{}
    if(ready)break;await new Promise(resolve=>setTimeout(resolve,500));
  }
  assert.ok(ready,`Production stack must start: ${logs.join('')}`);
  for(const offset of [2,1])await reconcileIncident((q,p)=>sql.query(q,p),{scope:'ci-observation',rule:'ci-observation',severity:'warning',message:'CI controlled incident',bad:true},new Date(Date.now()-offset*60000).toISOString());
  browser=await chromium.launch();
  for(const width of [390,1280]){
    const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const pageView=page.waitForResponse(response=>response.url().endsWith('/api/usage/events')&&response.request().method()==='POST');
    await page.goto(`${base}/privacy`);const tracked=await pageView;assert.equal(tracked.status(),202,'Real browser tracker must report coarse page activity');
    assert.equal(tracked.request().headers().referer || '','','Tracker must not transmit a full referrer URL');assert.deepEqual(tracked.request().postDataJSON(),{route:'/privacy'});
    await page.goto(`${base}/analytics`);
    assert.match(await page.title(),/Operations analytics/);
    assert.match(await page.locator('meta[name="robots"]').getAttribute('content'),/noindex/);
    await page.locator('#analytics-password').waitFor();
    await page.evaluate(()=>localStorage.setItem('token','ordinary-session-untouched'));
    assert.equal((await page.request.get(`${base}/api/analytics/submissions`)).status(),401);
    await page.getByLabel('Analytics password',{exact:true}).fill('wrong-password');await page.getByRole('button',{name:'Unlock operations'}).click();
    await page.getByRole('alert').filter({hasText:'Incorrect analytics password'}).waitFor();
    await page.getByLabel('Analytics password',{exact:true}).fill(process.env.ANALYTICS_CI_PASSWORD);
    await page.getByRole('button',{name:'Unlock operations'}).click();
    await page.getByRole('heading',{name:'Overview',exact:true}).waitFor();
    await page.getByRole('heading',{name:'Endpoint performance'}).waitFor();
    assert.equal((await page.request.get(`${base}/api/stats`)).status(),401,'Analytics session must not open admin APIs');
    const snapshot=await (await page.request.get(`${base}/api/analytics/overview`)).json();
    assert.equal(snapshot.database.healthy,true);assert.equal(snapshot.execution.status,'measured');assert.equal(snapshot.execution.availableSlots,null);
    assert.ok(snapshot.execution.queue.waiting>=1);
    const accepted=await page.request.post(`${base}/api/execute`,{data:{language:'python',code:'print(1)',input:''}});assert.equal(accepted.status(),202);extraJobs.push((await accepted.json()).jobId);
    const collection=await page.request.post(`${base}/api/analytics/collect`,{headers:{Origin:base,'X-Analytics-Request':'1'},data:{}});assert.equal(collection.status(),200);assert.equal((await collection.json()).lastError,null);
    for(const view of ['Overview','Runners','Submissions','Progress','History','Usage','Incidents','Access log']){
      await page.getByRole('button',{name:view,exact:true}).click();
      if(view==='Submissions'){
        const listingResponse=await page.request.get(`${base}/api/analytics/submissions?days=7&page=1`);
        assert.equal(listingResponse.status(),200);
        assert.equal((await listingResponse.json()).rows[0].student,'Analytics CI Student');
        await page.getByRole('cell').filter({hasText:'Analytics CI Student'}).first().waitFor();
        await page.getByRole('button',{name:'Submissions',exact:true}).click();
        await page.getByRole('status').filter({hasText:'Loading submissions'}).waitFor({state:'hidden'});
        await page.getByRole('button',{name:/Inspect submission/}).first().click();
        await page.locator('dialog pre').filter({hasText:'analytics-ci-source'}).waitFor();
        await page.getByRole('button',{name:'Close submission details'}).click();
      }
      if(view==='Progress')await page.getByRole('cell',{name:'1',exact:true}).first().waitFor();
      if(view==='History'){await page.getByRole('columnheader',{name:/^max sample p95$/i}).waitFor();const data=await(await page.request.get(`${base}/api/analytics/history`)).json();assert.ok(data.points.length>0);assert.ok(data.execution.summary.length>0);await page.getByRole('table',{name:'Execution phase summary',exact:true}).waitFor();const csv=await page.request.get(`${base}/api/analytics/export?type=execution`);assert.equal(csv.status(),200);assert.match(await csv.text(),/persist_ms/);}
      if(view==='Usage'){await page.getByRole('columnheader',{name:/^runs accepted$/i}).waitFor();const data=await(await page.request.get(`${base}/api/analytics/usage`)).json();assert.ok(data.daily.reduce((n,r)=>n+Number(r.page_views),0)>=1);assert.ok(data.daily.reduce((n,r)=>n+Number(r.runs),0)>=1);}
      if(view==='Incidents')await page.getByRole('cell',{name:/CI controlled incident/}).first().waitFor();
      if(view==='Access log')await page.getByRole('cell',{name:'VIEW_SUBMISSION',exact:true}).first().waitFor();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${view} must fit ${width}px`);
      await page.screenshot({path:`${out}/${view.toLowerCase().replaceAll(' ','-')}-${width}.png`,fullPage:true});
    }
    const exported=await page.request.get(`${base}/api/analytics/export?type=usage`);assert.equal(exported.status(),200);assert.match(await exported.text(),/page_views/);
    if(width===390){
      apiChild.kill('SIGTERM');await new Promise(resolve=>apiChild.once('exit',resolve));
      apiChild=launch(['apps/api/src/server.js'],apiEnvironment);
      let restarted=false;for(let i=0;i<80;i++){try{restarted=(await fetch(`${base}/api/live`,{signal:AbortSignal.timeout(1000)})).ok;}catch{}if(restarted)break;await new Promise(resolve=>setTimeout(resolve,250));}
      assert.ok(restarted);assert.equal((await page.request.get(`${base}/api/analytics/session`)).status(),200,'Analytics session survives API restart');
      const persisted=await(await page.request.get(`${base}/api/analytics/history`)).json();assert.ok(persisted.points.length>0,'Infrastructure history survives API restart');
      const usage=await(await page.request.get(`${base}/api/analytics/usage`)).json();assert.ok(usage.daily.length>0,'Usage survives restart');
    }
    await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByLabel('Analytics password',{exact:true}).waitFor();
    assert.equal((await page.request.get(`${base}/api/analytics/overview`)).status(),401);
    assert.equal(await page.evaluate(()=>localStorage.getItem('token')),'ordinary-session-untouched');
    assert.deepEqual(errors,[],'Dashboard must not produce browser exceptions');
    await context.close();
  }
  console.log('Analytics passed: real PostgreSQL and Redis, protected production APIs, independent login/logout, admin separation, submission inspection, progress and mobile/desktop layouts.');
}catch(error){
  const page=browser?.contexts().at(-1)?.pages().at(-1);
  if(page){
    await page.screenshot({path:`${out}/failure.png`,fullPage:true}).catch(()=>{});
    await writeFile(`${out}/failure-accessibility.txt`,await page.locator('body').ariaSnapshot().catch(()=>''));
    await writeFile(`${out}/failure-headers.json`,JSON.stringify(await page.locator('th').evaluateAll(nodes=>nodes.map(n=>({text:n.textContent,scope:n.getAttribute('scope'),role:n.getAttribute('role'),display:getComputedStyle(n).display,visibility:getComputedStyle(n).visibility}))),null,2));
  }
  throw error;
}finally{
  if(browser)await browser.close();
  if(gateway)await new Promise(resolve=>gateway.close(resolve));
  for(const child of children)child.kill('SIGTERM');
  for(const id of extraJobs){const job=await queue.getJob(id);await job?.remove().catch(()=>{});}
  await queued?.remove().catch(()=>{});await queue.close();await closeDatabase();
  await writeFile(`${out}/services.log`,logs.join(''));
}
