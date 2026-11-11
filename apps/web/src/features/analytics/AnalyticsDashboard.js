'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './analytics.module.css';

const views=['Overview','Runners','Submissions','Progress','Access log'];
const number=value=>value==null?'Unknown':Number(value).toLocaleString();
const duration=value=>value==null?'Unknown':`${(Number(value)/1000).toFixed(2)} s`;
const bytes=value=>value==null?'Unknown':`${(Number(value)/1024/1024).toFixed(1)} MiB`;
const time=value=>value?new Date(value).toLocaleString():'Not measured';

async function request(path,options={}) {
  const response=await fetch(`/api/analytics${path}`,{credentials:'same-origin',cache:'no-store',...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),'X-Analytics-Request':'1',...options.headers}});
  const data=await response.json().catch(()=>({error:'Analytics service did not return a valid response.'}));
  if(!response.ok) throw Object.assign(new Error(data.error || 'Analytics request failed.'),{status:response.status});
  return data;
}
function Metric({label,value,note}) {return <article className={styles.metric}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;}
function Panel({title,note,children}) {return <section className={styles.panel}><div className={styles.panelTitle}><h2>{title}</h2>{note&&<p>{note}</p>}</div>{children}</section>;}
function Empty({children}) {return <p className={styles.empty}>{children}</p>;}

export default function AnalyticsDashboard() {
  const [session,setSession]=useState('checking'),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[connectionError,setConnectionError]=useState('');
  const [view,setView]=useState('Overview'),[overview,setOverview]=useState(null),[paused,setPaused]=useState(false),[refresh,setRefresh]=useState(0);
  const [draft,setDraft]=useState({search:'',language:'',days:'7'}),[filters,setFilters]=useState({search:'',language:'',days:'7',page:1});
  const [submissions,setSubmissions]=useState(null),[progress,setProgress]=useState(null),[access,setAccess]=useState(null),[selected,setSelected]=useState(null),[detail,setDetail]=useState(null);
  const [dataBusy,setDataBusy]=useState(false),[detailError,setDetailError]=useState('');
  const [clock,setClock]=useState(0);
  const dialog=useRef(null);
  const clearPrivate=useCallback(()=>{setOverview(null);setSubmissions(null);setProgress(null);setAccess(null);setDetail(null);setSelected(null);setConnectionError('');},[]);
  const handleError=useCallback(err=>{if(err.name==='AbortError') return;if(err.status===401){clearPrivate();setSession('locked');}setError(err.message);},[clearPrivate]);

  useEffect(()=>{
    const controller=new AbortController();
    request('/session',{signal:controller.signal}).then(()=>{setSession('ready');setError('');}).catch(err=>{if(err.name!=='AbortError'){setSession('locked');if(err.status!==401)setError(err.message);}});
    return()=>controller.abort();
  },[]);

  useEffect(()=>{
    if(session!=='ready')return;
    const controller=new AbortController();let inFlight=false;
    async function load(){
      if(inFlight)return;inFlight=true;
      try {const data=await request('/overview',{signal:controller.signal});if(!controller.signal.aborted){setOverview(data);setConnectionError('');}}
      catch(err){if(err.name!=='AbortError'){setConnectionError(err.message);if(err.status===401)handleError(err);}}finally{inFlight=false;}
    }
    void load();
    const interval=setInterval(()=>{if(!paused&&!document.hidden)void load();},5000);
    return()=>{clearInterval(interval);controller.abort();};
  },[session,paused,refresh,handleError]);

  useEffect(()=>{
    if(session!=='ready'||!['Submissions','Progress','Access log'].includes(view))return;
    const controller=new AbortController();
    const path=view==='Submissions'?`/submissions?${new URLSearchParams(filters)}`:view==='Progress'?'/progress':'/access';
    request(path,{signal:controller.signal}).then(data=>{if(controller.signal.aborted)return;setError('');if(view==='Submissions')setSubmissions(data);else if(view==='Progress')setProgress(data);else setAccess(data);}).catch(handleError).finally(()=>{if(!controller.signal.aborted)setDataBusy(false);});
    return()=>controller.abort();
  },[view,session,filters,refresh,handleError]);

  useEffect(()=>{
    if(!selected||session!=='ready')return;
    const controller=new AbortController();dialog.current?.showModal();
    request(`/submissions/${selected}`,{signal:controller.signal}).then(data=>{if(!controller.signal.aborted)setDetail(data);}).catch(err=>{if(err.name!=='AbortError'){setDetailError(err.message);handleError(err);}});
    return()=>controller.abort();
  },[selected,session,handleError]);

  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),5000);return()=>clearInterval(timer);},[]);

  async function login(event){
    event.preventDefault();setBusy(true);setError('');
    try{await request('/session',{method:'POST',body:JSON.stringify({password})});setPassword('');setSession('ready');}
    catch(err){setError(err.message);}finally{setBusy(false);}
  }
  async function logout(){
    setBusy(true);
    try{await request('/session',{method:'DELETE'});clearPrivate();setSession('locked');setError('');}
    catch(err){if(err.status===401){clearPrivate();setSession('locked');}else setError(`Could not confirm sign-out: ${err.message}`);}finally{setBusy(false);}
  }
  const execution=overview?.execution, queue=execution?.queue;
  const stale=overview&&clock-overview.observedAt>20000;

  if(session!=='ready')return <main className={styles.loginShell}>
    <div className={styles.loginCard}><div className={styles.logo}>CodeRank <span>OPERATIONS</span></div><div className={styles.lockMark} aria-hidden="true">◈</div><h1>Behind the execution.</h1><p>Private monitoring for the people keeping CodeRank running.</p>
      {session==='checking'?<p role="status">Checking analytics access…</p>:<form onSubmit={login}><label htmlFor="analytics-password">Analytics password</label><input id="analytics-password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required maxLength={512}/>{error&&<p role="alert" className={styles.error}>{error}</p>}<button className={styles.primary} disabled={busy}>{busy?'Verifying…':'Unlock operations →'}</button></form>}
      <small>This console uses separate access from your institutional workspace.</small><a href="/">← Return to CodeRank</a>
    </div></main>;

  return <div className={styles.shell}>
    <a href="#analytics-main" className={styles.skip}>Skip to analytics content</a>
    <aside className={styles.sidebar}><div className={styles.logo}>CodeRank <span>OPERATIONS</span></div><p className={styles.sidebarCaption}>Visibility from submission<br/>to execution.</p><nav aria-label="Analytics sections">{views.map((item,i)=><button key={item} onClick={()=>{setDataBusy(true);if(item===view)setRefresh(v=>v+1);else setView(item);}} aria-current={view===item?'page':undefined}><span aria-hidden="true">0{i+1}</span>{item}</button>)}</nav><div className={styles.sidebarBottom}><span>Read-only console</span><a href="/">CodeRank home ↗</a><button onClick={logout} disabled={busy}>Sign out</button></div></aside>
    <main id="analytics-main" className={styles.main}>
      <header className={styles.header}><div><p className={styles.eyebrow}>SYSTEM OBSERVABILITY</p><h1>{view}</h1><p>Follow the work. Understand the system.</p></div><div className={styles.controls}><span className={styles.live} data-paused={paused||Boolean(error||connectionError)||stale}>{error||connectionError?'Connection issue':paused?'Updates paused':stale?'Data stale':'Live · every 5s'}</span><button onClick={()=>setPaused(!paused)} aria-pressed={paused}>{paused?'Resume':'Pause'}</button><button onClick={()=>{setDataBusy(true);setRefresh(v=>v+1);}}>Refresh</button></div></header>
      <p className={styles.timestamp}>Snapshot: {time(overview?.observedAt)} · Changes since this observation may not yet appear.</p>
      {(error||connectionError)&&<p className={styles.error} role="alert">{error||connectionError} Previously displayed values may be stale.</p>}
      {!overview&&<p role="status" className={styles.empty}>Collecting operational measurements…</p>}
      {view==='Overview'&&overview&&<>
        <div className={styles.metrics}><Metric label="Healthy workers" value={execution?.status==='measured'?number(execution.healthyWorkers):'Unknown'} note="Fresh capability heartbeats"/><Metric label="Available slots" value={number(execution?.availableSlots)} note="Measured accepting capacity"/><Metric label="Running executions" value={number(queue?.active)} note="Queue jobs in processing"/><Metric label="Waiting executions" value={number(queue?.waiting)} note={`Oldest wait: ${duration(queue?.oldestWaitingMs)}`}/></div>
        <div className={styles.twoColumns}><Panel title="System signals" note="Unknown measurements are never displayed as healthy zeros."><div className={styles.signal}><span>Database schema</span><b data-good={overview.database.healthy}>{overview.database.healthy?'Current':overview.database.schema}</b></div><div className={styles.signal}><span>Execution telemetry</span><b data-good={execution.status==='measured'}>{execution.status}</b></div><div className={styles.signal}><span>Capacity observation</span><b data-good={execution.capacityStatus==='measured'}>{execution.capacityStatus || 'unknown'}</b></div><div className={styles.signal}><span>API uptime</span><b>{duration(overview.http.uptimeSeconds*1000)}</b></div><div className={styles.signal}><span>Node runtime</span><b>{overview.nodeVersion}</b></div></Panel>
          <Panel title="Attention needed" note="Current conditions, not a durable incident history.">{overview.alerts.length?overview.alerts.map((alert,i)=><p className={styles.alert} data-severity={alert.severity} key={i}>{alert.message}</p>):<Empty>No monitored alert conditions in this snapshot.</Empty>}</Panel></div>
        <div className={styles.metrics}><Metric label="API requests" value={number(overview.http.requests)} note="Since this process restarted"/><Metric label="Server errors" value={number(overview.http.errors)} note="HTTP 5xx responses"/><Metric label="95th percentile latency" value={`${number(overview.http.latencyMs.p95)} ms`} note="Bounded recent response samples"/><Metric label="API process memory" value={bytes(overview.http.process.memory.rss)} note="Resident memory, when available"/></div>
        <Panel title="Endpoint performance" note={overview.http.scope}><div className={styles.tableWrap}><table><thead><tr><th>Endpoint</th><th>Requests</th><th>5xx errors</th><th>P95 latency</th></tr></thead><tbody>{overview.http.endpoints.map(row=><tr key={row.path}><td><code>{row.path}</code></td><td>{number(row.requests)}</td><td>{number(row.errors)}</td><td>{row.p95Ms} ms</td></tr>)}</tbody></table></div></Panel>
      </>}
      {view==='Runners'&&<>
        <div className={styles.metrics}><Metric label="Reported workers" value={execution?.status==='measured'?number(execution.reportedWorkers):'Unknown'} note="Worker processes reporting leases"/><Metric label="Configured slots" value={execution?.status==='measured'?number(execution.configuredSlots):'Unknown'} note="Configured concurrency of fresh workers"/><Metric label="Occupied slots" value={number(execution?.occupiedSlots)} note="From worker execution observations"/><Metric label="Available slots" value={number(execution?.availableSlots)} note="Unknown if any required measurement is missing"/></div>
        <Panel title="Execution fleet" note="Workers publish sampled measurements about every 10 seconds. Sandbox containers are isolated per job; free slots do not imply pre-created containers.">{execution?.workers?.length?<div className={styles.workerGrid}>{execution.workers.map(worker=><article className={styles.worker} key={worker.id}><div className={styles.workerTop}><h3>Worker {worker.id.slice(0,8)}</h3><span data-good={worker.healthy}>{!worker.fresh?'Stale':worker.healthy?'Healthy':'Unavailable'}</span></div><p className={styles.mono}>{worker.image}</p><div className={styles.signal}><span>Slots: occupied / configured</span><b>{number(worker.occupied)} / {worker.concurrency}</b></div><div className={styles.signal}><span>Available / accepting work</span><b>{number(worker.available)} / {worker.accepting?'Yes':'No'}</b></div><div className={styles.signal}><span>Running owned containers</span><b>{number(worker.containers?.running)}</b></div><div className={styles.signal}><span>Process RSS</span><b>{bytes(worker.process?.rssBytes)}</b></div><div className={styles.signal}><span>CPU (% of one core)</span><b>{number(worker.process?.cpuPercentOfOneCore)}</b></div><small>Heartbeat: {time(worker.checkedAt)}</small><h4>Active jobs at observation</h4>{worker.activeJobs.length?worker.activeJobs.map(job=><p className={styles.job} key={job.id}><code>{job.id}</code><span>{job.language || 'Unknown language'} · {job.type} · started {time(job.startedAt)}</span></p>):<p className={styles.muted}>{worker.fresh&&worker.occupied===0?'No active jobs reported.':'No reliable active-job detail.'}</p>}</article>)}</div>:<Empty>No reporting workers are available. Capacity is unknown.</Empty>}</Panel>
        <Panel title="Queue retention" note="These counters cover retained queue records, not lifetime submissions or student correctness."><div className={styles.metrics}><Metric label="Retained completed jobs" value={number(queue?.retainedCompleted)}/><Metric label="Retained failed jobs" value={number(queue?.retainedFailed)}/><Metric label="Delayed jobs" value={number(queue?.delayed)}/><Metric label="Paused / prioritized jobs" value={queue?`${number(queue.paused)} / ${number(queue.prioritized)}`:'Unknown'}/></div></Panel>
      </>}
      {view==='Submissions'&&<Panel title="Submission explorer" note="Latest recorded grade per student and practical. Open a record for code, test outcomes and up to 50 completed attempts.">
        <form className={styles.filters} onSubmit={e=>{e.preventDefault();setDataBusy(true);setFilters({...draft,page:1});}}><label>Find student, practical or course<input value={draft.search} maxLength={100} onChange={e=>setDraft({...draft,search:e.target.value})} placeholder="Search records…"/></label><label>Language<select value={draft.language} onChange={e=>setDraft({...draft,language:e.target.value})}><option value="">All languages</option>{['python','cpp','c','java','javascript'].map(l=><option key={l}>{l}</option>)}</select></label><label>Submitted within<select value={draft.days} onChange={e=>setDraft({...draft,days:e.target.value})}>{[1,7,30].map(d=><option key={d} value={d}>{d} day{d>1?'s':''}</option>)}</select></label><button className={styles.primary}>Apply filters</button></form>
        {dataBusy&&<p role="status">Loading submissions…</p>}
        {submissions?.rows.length?<div className={styles.tableWrap}><table><thead><tr><th>Student / course</th><th>Practical</th><th>Language</th><th>Score / 10</th><th>Status</th><th>Submitted</th><th>Inspect</th></tr></thead><tbody>{submissions.rows.map(row=><tr key={row.id}><td>{row.student}<small>{row.course}</small></td><td>{row.practical}</td><td>{row.language}</td><td>{row.normalized_marks}</td><td>{row.status}</td><td>{time(row.submitted_at)}</td><td><button onClick={()=>{setDetail(null);setDetailError('');setSelected(row.id);}} aria-label={`Inspect submission ${row.id}`}>Details ↗</button></td></tr>)}</tbody></table></div>:!dataBusy&&<Empty>No submissions match these filters.</Empty>}
        <div className={styles.pagination}><span>{number(submissions?.total)} matching records · page {filters.page}</span><button disabled={dataBusy||filters.page<=1} onClick={()=>{setDataBusy(true);setFilters({...filters,page:filters.page-1});}}>Previous</button><button disabled={dataBusy||!submissions||filters.page>=200||filters.page*25>=submissions.total} onClick={()=>{setDataBusy(true);setFilters({...filters,page:filters.page+1});}}>Next</button></div>
      </Panel>}
      {view==='Progress'&&<>
        <div className={styles.metrics}><Metric label="Active student accounts" value={number(overview?.academic?.students)} note="Account status, not online users"/><Metric label="Active practicals" value={number(overview?.academic?.practicals)}/><Metric label="Completed attempts · 7d" value={number(overview?.academic?.attempts_7d)}/><Metric label="Students who submitted · 7d" value={number(overview?.academic?.participating_students_7d)} note="Distinct submitting students"/></div>
        {dataBusy&&<p role="status">Loading academic activity…</p>}
        <Panel title="Assessment activity · 30 days" note={progress?.scope || 'Durable completed assessment activity.'}>{progress?.daily.length?<><div className={styles.chart} role="img" aria-label="Completed attempts by day; exact values appear in the following table.">{progress.daily.map(day=><div key={day.day} title={`${time(day.day)}: ${day.attempts} attempts`}><span style={{height:`${Math.max(3,Number(day.attempts)/Math.max(...progress.daily.map(d=>Number(d.attempts)))*100)}%`}}/></div>)}</div><div className={styles.tableWrap}><table><thead><tr><th>Day</th><th>Attempts</th><th>Students</th><th>Average score / 10</th></tr></thead><tbody>{progress.daily.map(day=><tr key={day.day}><td>{new Date(day.day).toLocaleDateString()}</td><td>{day.attempts}</td><td>{day.students}</td><td>{day.average_score}</td></tr>)}</tbody></table></div></>:<Empty>No completed assessment attempts in this period.</Empty>}</Panel>
        <div className={styles.twoColumns}><Panel title="Language usage · 30 days">{progress?.languages.map(row=><div className={styles.signal} key={row.language}><span>{row.language}</span><b>{row.attempts} attempts · {row.average_score}/10</b></div>)}</Panel><Panel title="Course participation" note="Current latest grades; assignment-level completion denominators are not inferred.">{progress?.courses.map(row=><div className={styles.signal} key={row.id}><span>{row.course_code}<small>{row.name}</small></span><b>{row.participating_students} students · {row.latest_grades} grades</b></div>)}</Panel></div>
      </>}
      {view==='Access log'&&<Panel title="Analytics access log" note="Latest 100 login, logout and submission-detail access records. No passwords, session tokens or student source code are logged.">{dataBusy?<p role="status">Loading access records…</p>:access?.rows.length?<div className={styles.tableWrap}><table><thead><tr><th>Time</th><th>Action</th><th>Reference</th></tr></thead><tbody>{access.rows.map((row,i)=><tr key={`${row.created_at}-${i}`}><td>{time(row.created_at)}</td><td>{row.action}</td><td>{row.detail || '—'}</td></tr>)}</tbody></table></div>:<Empty>No analytics access events recorded.</Empty>}</Panel>}
      <footer className={styles.footer}>CodeRank Operations · Separate analytics access · Read-only academic and execution data</footer>
    </main>
    {selected&&<dialog ref={dialog} className={styles.dialog} onClose={()=>setSelected(null)} aria-labelledby="submission-detail-title"><header><h2 id="submission-detail-title">Submission {selected}</h2><button onClick={()=>dialog.current?.close()} aria-label="Close submission details">Close ×</button></header>{detailError&&<p role="alert" className={styles.error}>{detailError}</p>}{!detail&&!detailError&&<p role="status">Loading submission…</p>}{detail&&<><p>{detail.student} · {detail.practical} · {detail.language} · {detail.normalized_marks}/10</p><p className={styles.muted}>{detail.note}</p><h3>Submitted source {detail.code_truncated?'(truncated at 65,536 characters)':''}</h3><pre>{detail.code}</pre><h3>Test outcomes</h3>{detail.cases.map(row=><details key={row.test_case_id}><summary>Case {row.test_case_id}: {row.passed?'Passed':'Failed'} · {row.marks_awarded} marks · {duration(row.execution_time_ms)}</summary><pre>{row.actual_output || row.error_message || 'No recorded output.'}</pre></details>)}<h3>Recent completed attempts</h3>{detail.attempts.length?detail.attempts.map(row=><div className={styles.job} key={row.job_id}><code>{row.job_id}</code><span>{row.language} · {row.normalized_marks}/10 · submitted {time(row.submitted_at)} · recorded {time(row.completed_at)}</span></div>):<p>No completed attempt history recorded.</p>}</>}</dialog>}
  </div>;
}
