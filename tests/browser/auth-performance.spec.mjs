import {test, expect} from '@playwright/test';
import {mkdirSync, writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
// Credentials must never enter performance artifacts, traces or screenshots.
test.use({trace:'off', screenshot:'off', video:'off'});
const output='test-results/authenticated';
const parseTiming=value=>Object.fromEntries((value || '').split(',').map(part=>part.trim().match(/^([a-z_]+);dur=([\d.]+)$/)).filter(Boolean).map(m=>[m[1],Number(m[2])]));
const elapsed=start=>+(performance.now()-start).toFixed(2);
async function adminLogin(request) {
 const res=await request.post('/api/auth/login',{data:{email:process.env.E2E_ADMIN_EMAIL,password:process.env.E2E_ADMIN_PASSWORD}});
 expect(res.status()).toBe(200);return res.json();
}
async function observer(context) {
 await context.addInitScript(()=>{
  window.__timingLcp=null;
  new PerformanceObserver(list=>{const entries=list.getEntries();window.__timingLcp=entries.at(-1)?.startTime ?? null;}).observe({type:'largest-contentful-paint',buffered:true});
 });
}
async function navigation(page) {
 return page.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0];return {ttfbMs:n?.responseStart ?? null,domContentLoadedMs:n?.domContentLoadedEventEnd ?? null,observedLcpMs:window.__timingLcp};});
}
function save(name, samples) {mkdirSync(output,{recursive:true});writeFileSync(`${output}/${name}.json`,JSON.stringify({conditions:'Production-mode loopback stack. Cold means fresh browser context/cache, not restarted server or cold database.',samples},null,2));}

test('measure 20 successful sign-ins per fresh and reused browser condition',async({browser,request})=>{
 test.setTimeout(240000);
 const admin=await adminLogin(request);const samples=[];const nonce=randomUUID().slice(0,8);
 for(const condition of ['fresh-context','reused-context']) {
  let context;
  try {
   if(condition==='reused-context'){context=await browser.newContext();await observer(context);}
   for(let i=0;i<20;i++) {
    const email=`perf-${nonce}-${condition}-${i}@e2e.test`;
    const created=await request.post('/api/users',{headers:{Authorization:`Bearer ${admin.token}`},data:{name:'Timing Faculty',email,role:'faculty'}});
    expect(created.status()).toBe(200);
    const account=await created.json();expect(account.rawPassword).toBeTruthy();
    if(condition==='fresh-context'){context=await browser.newContext();await observer(context);}
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.name));
    const pageStart=performance.now();await page.goto('/login');
    await page.getByRole('button',{name:'Sign In →',exact:true}).waitFor();
    const loginPageReadyMs=elapsed(pageStart),loginNavigation=await navigation(page);
    await page.getByLabel('Username or Email',{exact:true}).fill(email);
    await page.getByLabel('Password',{exact:true}).fill(account.rawPassword);
    const responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/auth/login')&&r.request().method()==='POST');
    const dashboardData=Promise.all(['/api/faculty/courses','/api/faculty/batches'].map(path=>page.waitForResponse(r=>new URL(r.url()).pathname===path)));
    const start=performance.now();await page.getByRole('button',{name:'Sign In →',exact:true}).click();
    const response=await responsePromise;expect(response.status()).toBe(200);
    const body=await response.json();expect(body.token).toBeTruthy();
    const sessionResponseMs=elapsed(start);
    await expect(page).toHaveURL(/\/faculty\/?$/);
    await expect(page.getByRole('heading',{name:'Select Allocated Subject',exact:true})).toBeVisible();
    for(const res of await dashboardData){expect(res.status()).toBe(200);await res.json();}
    const dashboardReadyMs=elapsed(start);
    await page.waitForTimeout(150);
    expect(errors).toEqual([]);
    samples.push({condition,index:i+1,loginPageReadyMs,loginNavigation,sessionResponseMs,dashboardReadyMs,responseToDashboardMs:+(dashboardReadyMs-sessionResponseMs).toFixed(2),server:parseTiming(response.headers()['server-timing']),dashboardNavigation:await navigation(page)});
    await page.close();if(condition==='fresh-context'){await context.close();context=null;}
   }
  }finally{await context?.close();save('login-browser-timing',samples);}
 }
 expect(samples.filter(s=>s.condition==='fresh-context')).toHaveLength(20);expect(samples).toHaveLength(40);
});

test('measure 20 real account creations and visible confirmation per browser condition',async({browser,request})=>{
 test.setTimeout(240000);
 const admin=await adminLogin(request),samples=[];const baseNumber=Number(String(Date.now()).slice(-7));
 for(const condition of ['fresh-context','reused-context']) {
  let context;
  try {
   if(condition==='reused-context')context=await browser.newContext({acceptDownloads:true});
   for(let i=0;i<20;i++) {
    if(condition==='fresh-context')context=await browser.newContext({acceptDownloads:true});
    if(condition==='fresh-context'||i===0)await context.addInitScript(identity=>{localStorage.setItem('token',identity.token);localStorage.setItem('user',JSON.stringify(identity.user));},admin);
    const page=await context.newPage();await page.goto('/admin/students');
    await page.getByRole('button',{name:'+ Add Student',exact:true}).click();
    await page.getByPlaceholder('First Name *',{exact:true}).fill('Timing');
    await page.getByPlaceholder('Last Name *',{exact:true}).fill('Student');
    await page.getByPlaceholder('Roll Number (e.g. 25ce097 or D25ce097) *',{exact:true}).fill(`25ce${baseNumber+(condition==='fresh-context'?0:20)+i}`);
    await page.getByPlaceholder('Division (e.g. CE1, IT2) *',{exact:true}).fill('CE1');
    const form=page.locator('form');await form.locator('select').nth(0).selectOption('1');await form.locator('select').nth(1).selectOption('CI Department');
    const responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/users')&&r.request().method()==='POST');
    const downloadPromise=page.waitForEvent('download');
    const start=performance.now();await page.getByRole('button',{name:'Create Student',exact:true}).click();
    const res=await responsePromise;expect(res.status()).toBe(200);await res.json();const responseMs=elapsed(start);
    await downloadPromise;await expect(page.getByText('Timing created! Password PDF downloaded.',{exact:true})).toBeVisible();
    samples.push({condition,index:i+1,responseMs,confirmationMs:elapsed(start),server:parseTiming(res.headers()['server-timing'])});
    await page.close();if(condition==='fresh-context'){await context.close();context=null;}
   }
  }finally{await context?.close();save('account-creation-browser-timing',samples);}
 }
 expect(samples).toHaveLength(40);
});
