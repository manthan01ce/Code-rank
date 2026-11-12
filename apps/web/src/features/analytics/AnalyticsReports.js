'use client';
import { useEffect,useState } from 'react';
import styles from './analytics.module.css';

const value=v=>v==null?'Unknown':Number(v).toLocaleString();
const utc=v=>new Date(v).toLocaleString(undefined,{timeZone:'UTC'});
const milliseconds=v=>v==null?'Not observed':`${Number(v).toFixed(1)} ms`;
const mib=v=>v==null?'Unknown':`${(Number(v)/1048576).toFixed(1)} MiB`;
export default function AnalyticsReports({view,request,onError,onSuccess,refresh}){
 const [hours,setHours]=useState('24'),[instance,setInstance]=useState(''),[status,setStatus]=useState('all'),[result,setResult]=useState({}),[collecting,setCollecting]=useState(false),[revision,setRevision]=useState(0);
 const type=view.toLowerCase(),key=`${type}:${hours}:${instance}:${status}:${refresh}:${revision}`;
 const params=new URLSearchParams({hours,instance,status});
 const data=result.key===key?result.data:null,loading=result.key!==key;
 useEffect(()=>{
  const controller=new AbortController();
  request(`/${type}?${new URLSearchParams({hours,instance,status})}`,{signal:controller.signal}).then(data=>{
   if(controller.signal.aborted)return;
   onSuccess();setResult({key,data});
   if(type==='history'&&!instance&&data.range?.instance)setInstance(data.range.instance);
  }).catch(error=>{if(error.name!=='AbortError'){setResult({key,error:error.message});onError(error);}});
  return()=>controller.abort();
 },[type,hours,instance,status,refresh,revision,key,request,onError,onSuccess]);
 const collector=data?.collector;
 async function collectNow(){setCollecting(true);try{await request('/collect',{method:'POST',body:'{}'});setRevision(v=>v+1);}catch(error){onError(error);}finally{setCollecting(false);}}
 return <>
  <section className={styles.panel}>
   <div className={styles.reportHeading}><div className={styles.panelTitle}><h2>{view==='History'?'Infrastructure history':view==='Usage'?'Usage and adoption':'Incident timeline'}</h2><p>{data?.scope || 'Stored observations and activity from the optional analytics collector.'}</p></div>
    <div className={styles.controls}>
     {type!=='incidents'?<label>Report range<select aria-label="Report range" value={hours} onChange={e=>setHours(e.target.value)}>{[['1','Last hour'],['24','Last day'],['168','Last week'],['720','Last 30 days']].map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>:<label>Incident status<select aria-label="Incident status" value={status} onChange={e=>setStatus(e.target.value)}>{['all','open','resolved'].map(v=><option key={v}>{v}</option>)}</select></label>}
     {type==='history'&&<label>API instance<select aria-label="API instance" value={instance} onChange={e=>setInstance(e.target.value)}>{[...new Set([instance,...(data?.instances || [])])].map(v=><option value={v} key={v}>{v || 'Current API instance'}</option>)}</select></label>}
     {collector&&<button disabled={collecting||(!collector.collectionEnabled&&!collector.usageEnabled)} onClick={collectNow}>{collecting?'Collecting…':'Collect now'}</button>}
     {data&&<a className={styles.exportLink} href={`/api/analytics/export?type=${type}&${params}`}>Download CSV ↗</a>}
    </div>
   </div>
   {loading&&<p role="status" className={styles.empty}>Loading {type} report…</p>}
   {result.key===key&&result.error&&<p role="alert" className={styles.error}>{result.error}</p>}
   {collector&&<div className={styles.collector}><span>Responding collector: {collector.instanceId}</span><span>History: {collector.collectionEnabled?'enabled':'disabled'}</span><span>Usage: {collector.usageEnabled?'enabled':'disabled'}</span><span>Last persisted: {collector.lastSuccess?utc(collector.lastSuccess)+' UTC':'Not yet observed in this API process'}</span><span>Buffered groups: {collector.pendingUsageBuckets} · Dropped this process: {collector.droppedEvents}</span>{collector.lastError&&<strong>{collector.lastError}</strong>}</div>}
   {type==='history'&&data&&(data.points.length?<>
    <div className={styles.chart} role="img" aria-label="Peak waiting queue jobs by UTC time bucket. Exact values are in the table below.">{data.points.map(point=><div key={point.bucket} title={`${utc(point.bucket)} UTC: ${point.peak_waiting??'unknown'} waiting`}><span data-missing={point.peak_waiting===null} style={{height:point.peak_waiting===null?'0%':`${Math.max(0,Number(point.peak_waiting)/Math.max(1,...data.points.map(p=>Number(p.peak_waiting)||0))*100)}%`}}/></div>)}</div>
    <div className={styles.tableWrap}><table aria-label={type==='history'?'Infrastructure history':'Usage history'}><thead><tr><th scope="col">Bucket · UTC</th><th scope="col">Avg requests/s</th><th scope="col">Max sample P95</th><th scope="col">Peak API RSS</th><th scope="col">Avg CPU · one core</th><th scope="col">Peak waiting / running</th><th scope="col">Minimum available slots</th><th scope="col">Unknown capacity samples</th></tr></thead><tbody>{data.points.map(point=><tr key={point.bucket}><td>{utc(point.bucket)}</td><td>{value(point.average_request_rate)}</td><td>{value(point.max_sample_p95_ms)} ms</td><td>{mib(point.peak_rss_bytes)}</td><td>{value(point.average_cpu_percent)}%</td><td>{value(point.peak_waiting)} / {value(point.peak_running)}</td><td>{value(point.minimum_available)}</td><td>{point.unknown_capacity_samples} / {point.samples}</td></tr>)}</tbody></table></div>
   </>:<p className={styles.empty}>No stored infrastructure samples in this range. Enable collection on the API to start history; missing periods are not represented as zeros.</p>)}
   {type==='usage'&&data&&(data.daily.length?<div className={styles.tableWrap}><table aria-label={type==='history'?'Infrastructure history':'Usage history'}><thead><tr><th scope="col">Bucket · UTC</th><th scope="col">Page views</th><th scope="col">API requests</th><th scope="col">Runs accepted</th><th scope="col">Submissions accepted</th><th scope="col">Active authenticated accounts</th></tr></thead><tbody>{data.daily.map(row=><tr key={row.bucket}><td>{utc(row.bucket)}</td><td>{value(row.page_views)}</td><td>{value(row.api_requests)}</td><td>{value(row.runs)}</td><td>{value(row.submissions)}</td><td>{value(row.active_accounts)}</td></tr>)}</tbody></table></div>:<p className={styles.empty}>No persisted usage in this range. Optional usage collection is disabled until the API is configured to enable it.</p>)}
   {type==='incidents'&&data&&(data.rows.length?<div className={styles.tableWrap}><table><thead><tr><th scope="col">Condition</th><th scope="col">Scope</th><th scope="col">State</th><th scope="col">First observed · UTC</th><th scope="col">Confirmed · UTC</th><th scope="col">Recovered · UTC</th></tr></thead><tbody>{data.rows.map(row=><tr key={row.id}><td>{row.message}<small>{row.severity} · {row.rule}</small></td><td>{row.scope}</td><td>{row.resolved_at?'Resolved':'Open'}</td><td>{utc(row.opened_at)}</td><td>{utc(row.confirmed_at)}</td><td>{row.resolved_at?utc(row.resolved_at):'Not observed'}</td></tr>)}</tbody></table></div>:<p className={styles.empty}>No confirmed incidents match this filter. An empty history is not proof that monitoring was running.</p>)}
  </section>
  {type==='history'&&data?.execution&&<section className={styles.panel}>
   <div className={styles.panelTitle}><h2>Execution phase timings</h2><p>{data.execution.scope} These records cover all workers, independently of the selected API instance.</p></div>
   <a className={styles.exportLink} href={`/api/analytics/export?type=execution&hours=${hours}`}>Download execution CSV ↗</a>
   {data.execution.summary.length?<>
    <div className={styles.tableWrap}><table aria-label="Execution phase summary"><thead><tr>{['Kind / language','Recorded attempts','Avg queue wait','Avg worker duration','Worker P95','Avg preparation / compile','Avg execution','Avg combined harness','Avg persistence','Avg cleanup'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{data.execution.summary.map(row=><tr key={`${row.kind}:${row.language}`}><td>{row.kind} / {row.language}</td><td>{row.jobs}</td><td>{milliseconds(row.average_queue_ms)}</td><td>{milliseconds(row.average_worker_ms)}</td><td>{milliseconds(row.p95_worker_ms)}</td><td>{milliseconds(row.average_prepare_compile_ms)}<small>{row.compile_observations} observed</small></td><td>{milliseconds(row.average_execute_ms)}<small>{row.execute_observations} observed</small></td><td>{milliseconds(row.average_harness_ms)}<small>{row.harness_observations} observed</small></td><td>{milliseconds(row.average_persist_ms)}<small>{row.persist_observations} observed</small></td><td>{milliseconds(row.average_cleanup_ms)}</td></tr>)}</tbody></table></div>
    <h3>Recent processor attempts</h3><div className={styles.tableWrap}><table aria-label="Recent execution timings"><thead><tr>{['Job / attempt','Kind / language','Outcome','Observed · UTC','Queue','Worker','Prepare / compile','Execute','Combined harness','Persist','Cleanup'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{data.execution.recent.map((row,i)=><tr key={i}><td>{row.job_id} / {row.attempt}</td><td>{row.kind} / {row.language}</td><td>{row.outcome}</td><td>{utc(row.observed_at)}</td>{['queue_ms','worker_ms','prepare_compile_ms','execute_ms','harness_ms','persist_ms','cleanup_ms'].map(field=><td key={field}>{milliseconds(row[field])}</td>)}</tr>)}</tbody></table></div>
   </>:<p className={styles.empty}>No recorded execution timings in this range. Enable execution recording on workers, then run or submit code. Existing jobs are not backfilled.</p>}
  </section>}
  {type==='history'&&data&&<section className={styles.panel}><div className={styles.panelTitle}><h2>First observed release versions</h2><p>These are collection observations, not deployment start times.</p></div>{data.releases.map(row=><div className={styles.signal} key={row.release}><span>{row.release}</span><b>{utc(row.first_observed)} UTC · {row.process_boots} process boots</b></div>)}</section>}
  {type==='usage'&&data&&<div className={styles.twoColumns}><section className={styles.panel}><h2>Route activity</h2><div className={styles.tableWrap}><table><thead><tr><th scope="col">Coarse route</th><th scope="col">Event</th><th scope="col">Count</th></tr></thead><tbody>{data.routes.map((row,i)=><tr key={i}><td>{row.route}</td><td>{row.kind}</td><td>{value(row.events)}</td></tr>)}</tbody></table></div></section><section className={styles.panel}><h2>Authenticated account activity</h2>{data.roles.filter(row=>row.role!=='guest').map(row=><div className={styles.signal} key={row.role}><span>{row.role}</span><b>{value(row.active_accounts)} distinct accounts</b></div>)}</section></div>}
  {type==='incidents'&&data&&<section className={styles.panel}><div className={styles.panelTitle}><h2>Last rule observations</h2><p>Stale and unknown observations cannot establish recovery.</p></div>{data.states.map(row=><div className={styles.signal} key={`${row.scope}:${row.rule}`}><span>{row.rule}<small>{row.scope}</small></span><b data-good={!row.stale&&row.status==='good'}>{row.stale?'Stale':row.status} · {utc(row.last_bucket)} UTC</b></div>)}</section>}
 </>;
}
