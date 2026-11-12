import { randomBytes } from 'node:crypto';
import { readFile,writeFile,chmod,access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { analyticsConfig,hashAnalyticsPassword } from '../../apps/api/src/modules/analytics/auth.js';

export async function configureAnalytics({password,origin,file,recording=false,root=process.cwd()}){
  const hash=await hashAnalyticsPassword(password),secret=randomBytes(48).toString('hex');
  origin=analyticsConfig({ANALYTICS_PASSWORD_HASH:hash,ANALYTICS_SESSION_SECRET:secret,ANALYTICS_ORIGIN:origin}).origin;
  if(!file){try{await access(resolve(root,'.env.local'));file='.env.local';}catch{file='.env';}}
  const selected=resolve(root,file);let existing='';
  try{existing=await readFile(selected,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
  const priorUsage=existing.match(/^\s*(?:export\s+)?ANALYTICS_USAGE_SECRET\s*=\s*['"]?([a-f0-9]{64})['"]?\s*(?:#.*)?$/m)?.[1];
  const usageSecret=priorUsage || randomBytes(32).toString('hex');
  const changed=['PASSWORD_HASH','SESSION_SECRET','ORIGIN','USAGE_SECRET',...(recording?['COLLECTION_ENABLED','USAGE_ENABLED','EXECUTION_ENABLED']:[])];
  const pattern=new RegExp(`^\\s*(?:export\\s+)?ANALYTICS_(?:${changed.join('|')})\\s*=`);
  const retained=existing.split('\n').filter(line=>!pattern.test(line)).join('\n');
  const flags=recording?'ANALYTICS_COLLECTION_ENABLED=true\nANALYTICS_USAGE_ENABLED=true\nANALYTICS_EXECUTION_ENABLED=true\n':'';
  await writeFile(selected,`${retained.trimEnd()}\nANALYTICS_PASSWORD_HASH='${hash}'\nANALYTICS_SESSION_SECRET='${secret}'\nANALYTICS_ORIGIN='${origin}'\nANALYTICS_USAGE_SECRET='${usageSecret}'\n${flags}`,{mode:0o600});
  await chmod(selected,0o600);
  return selected;
}
