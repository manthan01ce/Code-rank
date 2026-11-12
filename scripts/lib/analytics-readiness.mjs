import { analyticsConfig } from '../../apps/api/src/modules/analytics/auth.js';
import { checkDatabaseReadiness } from '@coderank/database/readiness';
import { withTimeout } from '@coderank/core/shared/timeout';

// Read-only operator diagnostics. Never include env values or database errors.
export async function checkAnalyticsReadiness({env=process.env,query,origin}={}){
  const checks=[];let config;
  try{config=analyticsConfig(env);checks.push({name:'access configuration',ok:true});}
  catch{checks.push({name:'access configuration',ok:false,fix:'Run npm run analytics:setup -- --origin <exact browser origin>. Restart the API afterward.'});}
  if(origin){let matches=false;try{matches=config?.origin===new URL(origin).origin&&new URL(origin).pathname==='/';}catch{}
    checks.push({name:'browser origin',ok:matches,...(!matches?{fix:'Set the analytics origin to the exact scheme, hostname and port used in your browser.'}:{})});}
  const usage=env.ANALYTICS_USAGE_ENABLED==='true';
  checks.push({name:'usage key',ok:!usage||/^[a-f0-9]{64}$/.test(env.ANALYTICS_USAGE_SECRET||''),...((usage&&!/^[a-f0-9]{64}$/.test(env.ANALYTICS_USAGE_SECRET||''))?{fix:'Run analytics:setup to generate the stable backend usage key.'}:{})});
  if(!env.DATABASE_URL){checks.push({name:'database',ok:false,fix:'Configure DATABASE_URL for the intended local PostgreSQL database. No database was modified.'});}
  else {
    try{
      await withTimeout(query('SELECT 1 AS connected',[]),4000);checks.push({name:'database connection',ok:true});
      const ready=await withTimeout(checkDatabaseReadiness(query),4000);
      checks.push({name:'migration ledger',ok:ready.healthy,...(!ready.healthy?{fix:ready.schema==='mismatch'?'Migration checksums differ. Run db:preflight and inspect the mismatch before changing the database.':'Apply pending migrations with npm run db:migrate, then npm run db:preflight.'}:{})});
      for(const table of ['analytics_sessions','analytics_access','analytics_login_limits','analytics_samples','analytics_usage_buckets','analytics_collector_leases','analytics_rule_state','analytics_incidents','analytics_execution_timings'])await withTimeout(query(`SELECT 1 FROM ${table} LIMIT 0`,[]),4000);
      checks.push({name:'analytics tables and permissions',ok:true});
    }catch{checks.push({name:'database schema/access',ok:false,fix:'Check local PostgreSQL connectivity and permissions, then run db:migrate and db:preflight. Detailed database errors are omitted to protect credentials.'});}
  }
  return {ready:checks.every(c=>c.ok),checks,recording:{history:env.ANALYTICS_COLLECTION_ENABLED==='true',usage,execution:env.ANALYTICS_EXECUTION_ENABLED==='true'},note:'This checks the environment loaded by this command. Restart running API and worker processes after configuration changes. It does not change passwords, apply migrations, or modify data.'};
}
