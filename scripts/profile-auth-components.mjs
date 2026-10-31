/** Real local authentication primitives and failure-path timers; no DB or bcrypt mocks. */
import {performance} from 'node:perf_hooks';
import {writeFileSync,mkdirSync} from 'node:fs';
import {hashPassword,comparePassword} from '../packages/core/src/utils/auth.js';
import {UserService} from '../packages/core/src/modules/users/UserService.js';
import {checkRateLimit} from '../apps/web/src/lib/queue/rateLimiter.js';
const dir=process.env.PROFILE_OUTPUT || 'reports/auth-page-review-2026-10-22';
mkdirSync(dir,{recursive:true});
const round=x=>+x.toFixed(2);
const summarize=values=>{const s=[...values].sort((a,b)=>a-b);return {n:s.length,minMs:s[0],medianMs:s[Math.floor(s.length/2)],p95Ms:s[Math.ceil(s.length*.95)-1],maxMs:s.at(-1),avgMs:round(s.reduce((a,b)=>a+b,0)/s.length)};};
const report={method:'Actual bcrypt cost-10 and unavailable local dependency paths; no successful signup/login end-to-end measurement.',startedAt:new Date().toISOString()};
const hashTimes=[],compareTimes=[];
for(let i=0;i<10;i++){
 let start=performance.now();const hash=await hashPassword('local-timing-only-password');hashTimes.push(round(performance.now()-start));
 start=performance.now();if(!await comparePassword('local-timing-only-password',hash))throw Error('Comparison failed');compareTimes.push(round(performance.now()-start));
}
report.passwordHash=summarize(hashTimes);report.passwordCompare=summarize(compareTimes);
let start=performance.now();report.rateLimitResult=await checkRateLimit('timing-probe@example.invalid','login');report.rateLimitMs=round(performance.now()-start);
start=performance.now();try{await UserService.login({email:'timing-probe@example.invalid',password:'not-a-real-account'});report.directLoginService={unexpectedSuccess:true};}catch(error){report.directLoginService={elapsedMs:round(performance.now()-start),status:error.status || null,error:error.message};}
report.finishedAt=new Date().toISOString();
writeFileSync(`${dir}/auth-component-timings.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
