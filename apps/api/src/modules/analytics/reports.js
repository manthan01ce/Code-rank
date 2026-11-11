const invalid=message=>Object.assign(new Error(message),{statusCode:400});
export function reportRange(input={},fallback='') {
 const hours=Number(input.hours ?? 24),instance=String(input.instance || fallback);
 if(![1,24,168,720].includes(hours))throw invalid('Choose a 1, 24, 168 or 720 hour range.');
 if(instance&&!/^[a-zA-Z0-9_.-]{1,64}$/.test(instance))throw invalid('Invalid API instance.');
 return {hours,instance,unit:hours===1?'minute':hours===720?'day':'hour'};
}
export function csvReport(rows) {
 const fields=Object.keys(rows[0] || {note:''});
 const cell=value=>{let text=value==null?'':String(value);if(/^[\s]*[=+\-@]|^[\t\r\n]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
 return '\uFEFF'+[fields,...rows.map(row=>fields.map(field=>row[field]))].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
export function createAnalyticsReports(query,runtime) {
 return {
  async history(input={}){
   const range=reportRange(input,runtime?.instanceId);
   const [instances,points,releases]=await Promise.all([
    query("SELECT DISTINCT instance_id FROM analytics_samples WHERE observed_at>=now()-interval '30 days' ORDER BY instance_id LIMIT 100",[]),
    query(`SELECT date_trunc($1,observed_at,'UTC') AS bucket,max(observed_at) AS last_observed,count(*)::int AS samples,
      round(avg(request_rate),2) AS average_request_rate,max(latency_p95_ms) AS max_sample_p95_ms,
      max(rss_bytes) AS peak_rss_bytes,round(avg(cpu_percent),2) AS average_cpu_percent,
      max(queue_waiting) AS peak_waiting,max(queue_active) AS peak_running,min(available_slots) AS minimum_available,
      count(*) FILTER(WHERE execution_status<>'measured')::int AS unavailable_samples,
      count(*) FILTER(WHERE available_slots IS NULL)::int AS unknown_capacity_samples
      FROM analytics_samples WHERE observed_at>=now()-make_interval(hours=>$2) AND instance_id=$3 GROUP BY 1 ORDER BY 1 LIMIT 360`,[range.unit,range.hours,range.instance]),
    query(`SELECT release,min(observed_at) AS first_observed,max(observed_at) AS last_observed,count(DISTINCT boot_id)::int AS process_boots FROM analytics_samples WHERE instance_id=$1 AND observed_at>=now()-make_interval(hours=>$2) GROUP BY release ORDER BY first_observed DESC LIMIT 20`,[range.instance,range.hours]),
   ]);
   return {instances:instances.map(row=>row.instance_id),points,releases,range,lastStoredAt:points.at(-1)?.last_observed || null,collector:runtime?.getState()||null,
    scope:'UTC buckets for one reporting API instance. Fleet gauges are not added across API replicas. Missing buckets are collection gaps, not zeros. P95 values are the maximum sampled recent P95, not a combined percentile.'};
  },
  async usage(input={}){
   const {hours,unit}=reportRange(input);
   const [daily,routes,kinds]=await Promise.all([
    query(`SELECT date_trunc($1,bucket,'UTC') AS bucket,
      COALESCE(sum(events) FILTER(WHERE kind='page_view'),0)::bigint AS page_views,
      COALESCE(sum(events) FILTER(WHERE kind='api_request'),0)::bigint AS api_requests,
      COALESCE(sum(events) FILTER(WHERE kind='run_accepted'),0)::bigint AS runs,
      COALESCE(sum(events) FILTER(WHERE kind='submit_accepted'),0)::bigint AS submissions,
      count(DISTINCT actor_key) FILTER(WHERE actor_key<>'')::int AS active_accounts
      FROM analytics_usage_buckets WHERE bucket>=now()-make_interval(hours=>$2) GROUP BY 1 ORDER BY 1 LIMIT 360`,[unit,hours]),
    query(`SELECT route,kind,sum(events)::bigint AS events FROM analytics_usage_buckets WHERE bucket>=now()-make_interval(hours=>$1) GROUP BY route,kind ORDER BY events DESC,route LIMIT 100`,[hours]),
    query(`SELECT role,count(DISTINCT actor_key) FILTER(WHERE actor_key<>'')::int AS active_accounts FROM analytics_usage_buckets WHERE bucket>=now()-make_interval(hours=>$1) GROUP BY role ORDER BY role`,[hours]),
   ]);
   return {daily,routes,roles:kinds,hours,collector:runtime?.getState()||null,
    scope:'Page views are optional client-reported navigation counts, not unique visitors. Active accounts have validated authenticated API activity, including background requests. Runs and submissions count accepted queue requests, not completed or correct answers. No browser identifiers, raw URLs, IP addresses or source code are stored.'};
  },
  async incidents(input={}){
   const status=String(input.status || 'all');if(!['all','open','resolved'].includes(status))throw invalid('Choose all, open or resolved incidents.');
   const rows=await query(`SELECT id,scope,rule,severity,message,opened_at,confirmed_at,last_seen_at,resolved_at FROM analytics_incidents
    WHERE ($1='all' OR ($1='open' AND resolved_at IS NULL) OR ($1='resolved' AND resolved_at IS NOT NULL)) ORDER BY confirmed_at DESC,id DESC LIMIT 100`,[status]);
   const states=await query("SELECT scope,rule,status,last_bucket,last_bucket<now()-interval '90 seconds' AS stale FROM analytics_rule_state ORDER BY last_bucket DESC LIMIT 200",[]);
   return {rows,states,collector:runtime?.getState()||null,scope:'Incidents open after two consecutive bad samples and resolve after two good samples. Unknown measurements do not imply recovery. Times describe observed conditions; the monitor cannot persist events while its database is unavailable.'};
  },
 };
}
