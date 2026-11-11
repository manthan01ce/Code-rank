// Real PostgreSQL + Redis + API + production web + Chromium; no intercepted requests.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir,writeFile } from 'node:fs/promises';
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
const launch=args=>{const child=spawn(process.execPath,args,{env:process.env,stdio:['ignore','pipe','pipe']});children.push(child);child.stdout.on('data',chunk=>logs.push(String(chunk)));child.stderr.on('data',chunk=>logs.push(String(chunk)));return child;};
const queue=createExecutionQueue({host:process.env.REDIS_HOST||'127.0.0.1',port:Number(process.env.REDIS_PORT||6379),maxRetriesPerRequest:1});
let queued;
try{
  const [student]=await sql.query("INSERT INTO users(name,email,password,role) VALUES('Analytics CI Student','analytics-student@ci.example','unused-test-only-hash','student') RETURNING id",[]);
  const [faculty]=await sql.query("INSERT INTO users(name,email,password,role) VALUES('Analytics CI Faculty','analytics-faculty@ci.example','unused-test-only-hash','faculty') RETURNING id",[]);
  const [course]=await sql.query("INSERT INTO courses(course_code,name,semester) VALUES('AN-CI','Analytics verification',1) RETURNING id",[]);
  const [practical]=await sql.query("INSERT INTO practicals(faculty_id,course_id,title,total_marks) VALUES($1,$2,'Analytics CI practical',10) RETURNING id",[faculty.id,course.id]);
  await sql.query("INSERT INTO practical_submissions(student_id,practical_id,code,language,status,normalized_marks) VALUES($1,$2,convert_to($3,'UTF8'),'python','completed',10)",[student.id,practical.id,'print("analytics-ci-source")']);
  await sql.query("INSERT INTO submission_attempts(job_id,student_id,practical_id,code,language,normalized_marks,raw_marks,case_results,result,submitted_at) VALUES('analytics-ci-job',$1,$2,convert_to($3,'UTF8'),'python',10,10,'[]','{}',now())",[student.id,practical.id,'print("analytics-ci-source")']);
  queued=await queue.add('analytics-ci',{type:'practice',userId:student.id,payload:{language:'python',code:'print(1)'}});
  launch(['apps/api/src/server.js']);
  launch(['node_modules/next/dist/bin/next','start','apps/web','-H','127.0.0.1','-p','3313']);
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
  browser=await chromium.launch();
  for(const width of [390,1280]){
    const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
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
    for(const view of ['Overview','Runners','Submissions','Progress','Access log']){
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
      if(view==='Access log')await page.getByRole('cell',{name:'VIEW_SUBMISSION',exact:true}).first().waitFor();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${view} must fit ${width}px`);
      await page.screenshot({path:`${out}/${view.toLowerCase().replaceAll(' ','-')}-${width}.png`,fullPage:true});
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
  if(page)await page.screenshot({path:`${out}/failure.png`,fullPage:true}).catch(()=>{});
  throw error;
}finally{
  if(browser)await browser.close();
  if(gateway)await new Promise(resolve=>gateway.close(resolve));
  for(const child of children)child.kill('SIGTERM');
  await queued?.remove().catch(()=>{});await queue.close();await closeDatabase();
  await writeFile(`${out}/services.log`,logs.join(''));
}
