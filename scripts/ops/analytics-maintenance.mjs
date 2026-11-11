import '@coderank/core/config/env';
import { parseArgs } from 'node:util';
import sql,{closeDatabase} from '@coderank/database';
try{
  const {values}=parseArgs({options:{target:{type:'string'},apply:{type:'boolean',default:false},'access-days':{type:'string',default:'90'}}});
  if(!values.target||decodeURIComponent(new URL(process.env.DATABASE_URL).pathname.slice(1))!==values.target)throw Error('Explicit matching database target required.');
  const days=Number(values['access-days']);if(!Number.isInteger(days)||days<7||days>365)throw Error('Access log retention must be 7–365 days.');
  const targets=[['analytics_sessions',"expires_at<now() OR last_seen<now()-interval '15 minutes'",'token_hash',[]],['analytics_login_limits',"window_start<now()-interval '2 days'",'bucket',[]],['analytics_access','created_at<now()-make_interval(days=>$1)','id',[days]]];
  const report=[];
  for(const [table,where,key,params]of targets){
    const query=values.apply?`WITH expired AS (SELECT ${key} FROM ${table} WHERE ${where} LIMIT 1000) DELETE FROM ${table} USING expired WHERE ${table}.${key}=expired.${key} RETURNING ${table}.${key}`:`SELECT ${key} FROM ${table} WHERE ${where} LIMIT 1000`;
    const rows=await sql.query(query,params);report.push({table,rows:rows.length,mode:values.apply?'deleted':'preview'});
  }
  console.log(JSON.stringify(report));
}catch{console.error('Analytics maintenance failed. Verify the explicit target, migrations and retention policy.');process.exitCode=1;}finally{await closeDatabase();}
