// Deletes only monitoring-owned data, in bounded batches; academic records are excluded.
export async function retainAnalyticsHistory(query,{apply=false,days=30,limit=1000}={}){
 if(!Number.isInteger(days)||days<7||days>90||!Number.isInteger(limit)||limit<1||limit>1000)throw Error('Invalid analytics retention policy');
 const targets=[
  ['analytics_samples','observed_at<now()-make_interval(days=>$1)',['id'],days],
  ['analytics_usage_buckets','bucket<now()-make_interval(days=>$1)',['instance_id','boot_id','bucket','kind','route','role','actor_key'],days],
  ['analytics_incidents','resolved_at<now()-make_interval(days=>$1)',['id'],90],
 ];
 const result=[];
 for(const [table,where,keys,age] of targets){
  const columns=keys.join(','),matches=keys.map(key=>`${table}.${key}=expired.${key}`).join(' AND ');
  const statement=apply?`WITH expired AS (SELECT ${columns} FROM ${table} WHERE ${where} LIMIT $2 FOR UPDATE SKIP LOCKED) DELETE FROM ${table} USING expired WHERE ${matches} RETURNING 1`:`SELECT ${columns} FROM ${table} WHERE ${where} LIMIT $2`;
  const rows=await query(statement,[age,limit]);result.push({table,rows:rows.length,mode:apply?'deleted':'preview'});
 }
 return result;
}
