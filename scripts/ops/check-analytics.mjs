import '@coderank/core/config/env';
import { parseArgs } from 'node:util';
import sql,{closeDatabase} from '@coderank/database';
import { checkAnalyticsReadiness } from '../lib/analytics-readiness.mjs';
try{
  const {values}=parseArgs({options:{origin:{type:'string'}}});
  const report=await checkAnalyticsReadiness({origin:values.origin,query:(q,p)=>sql.query(q,p)});
  console.log(JSON.stringify(report,null,2));if(!report.ready)process.exitCode=1;
}catch{console.error('Analytics check failed. Verify command options and backend configuration.');process.exitCode=1;}
finally{await closeDatabase();}
