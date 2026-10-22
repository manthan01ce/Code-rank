import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const [before,after,output]=process.argv.slice(2);
assert.ok(before&&after&&output,'Usage: node scripts/compare-auth-performance.mjs baseline-dir candidate-dir output.json');
const stats=values=>{assert.ok(values.length===20&&values.every(v=>Number.isFinite(v)&&v>=0),'Requires 20 successful finite samples per condition');const s=[...values].sort((a,b)=>a-b);return {n:s.length,medianMs:+((s[9]+s[10])/2).toFixed(2),p95Ms:s[18],maxMs:s[19]};};
const rows=[];
for(const file of ['login-browser-timing.json','account-creation-browser-timing.json']){
 const b=JSON.parse(readFileSync(path.join(before,file),'utf8')).samples;
 const a=JSON.parse(readFileSync(path.join(after,file),'utf8')).samples;
 for(const condition of ['fresh-context','reused-context']){
  const baseline=b.filter(s=>s.condition===condition),candidate=a.filter(s=>s.condition===condition);
  const metrics=file.startsWith('login')?['loginPageReadyMs','sessionResponseMs','dashboardReadyMs','responseToDashboardMs']:['responseMs','confirmationMs'];
  for(const metric of metrics){const old=stats(baseline.map(s=>s[metric])),next=stats(candidate.map(s=>s[metric]));rows.push({condition,metric,baseline:old,candidate:next,medianChangePercent:old.medianMs?+((next.medianMs-old.medianMs)/old.medianMs*100).toFixed(2):null});}
 }
}
writeFileSync(output,JSON.stringify({scope:'Production-mode CI loopback stack. Fresh browser context is not cold server/database. Negative change means lower duration. No deployment-capacity claim.',rows},null,2));
console.log(`Compared ${rows.length} duration series with 20 successful samples per revision/condition`);
