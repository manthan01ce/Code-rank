import { randomUUID } from 'node:crypto';
import { withExecutionTiming } from '@coderank/runner/timing';

const fields=['queue_ms','worker_ms','prepare_compile_ms','execute_ms','harness_ms','persist_ms','cleanup_ms'];
const validOutcomes=new Set(['accepted','wrong_answer','compile_error','runtime_error','time_limit_exceeded','memory_limit_exceeded','internal_error']);
export function createExecutionTimings({query,enabled=process.env.ANALYTICS_EXECUTION_ENABLED==='true',now=Date.now,clock=()=>performance.now()}={}) {
  const rows=[];let pending,timer,stopped=false;
  const state={enabled,pending:0,dropped:0,lastStoredAt:null,lastError:null};
  function record(row){if(!enabled||stopped)return;if(rows.length>=200){state.dropped++;return;}rows.push(row);}
  return {
    state:()=>({...state,pending:rows.length}),
    async run(job,operation){
      if(!enabled)return operation();
      const timing={},start=clock(),startedAt=now();let result,outcome='worker_error';
      try{result=await withExecutionTiming(timing,operation);outcome=validOutcomes.has(result?.status)?result.status:result?.success===true?'completed':result?.success===false?'code_error':'completed';return result;}
      finally{
        const queued=Number(job.timestamp),wait=startedAt-queued;
        const row={event_id:randomUUID(),job_id:String(job.id).slice(0,80),attempt:Math.max(1,(Number(job.attemptsMade)||0)+1),kind:['dynamic','practice','playground'].includes(job.data.type)?job.data.type:'unknown',language:['c','cpp','java','python','javascript'].includes(job.data.payload?.language)?job.data.payload.language:'unknown',outcome,observed_at:new Date(now()).toISOString(),queue_ms:Number.isFinite(queued)&&queued>0&&wait>=0?wait:null,worker_ms:Math.max(0,clock()-start)};
        for(const phase of ['prepare_compile','execute','harness','persist','cleanup'])row[`${phase}_ms`]=timing[phase] ?? null;
        record(row);
      }
    },
    flush(){
      if(pending)return pending;
      if(!enabled||!rows.length)return Promise.resolve();
      const batch=rows.slice(0,50);
      pending=(async()=>{
        try{
          await query(`INSERT INTO analytics_execution_timings SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(event_id uuid,job_id varchar(80),attempt integer,kind varchar(20),language varchar(20),outcome varchar(32),observed_at timestamptz,${fields.map(f=>`${f} double precision`).join(',')}) ON CONFLICT(event_id) DO NOTHING`,[JSON.stringify(batch)]);
          rows.splice(0,batch.length);state.lastStoredAt=new Date(now()).toISOString();state.lastError=null;
        }catch{state.lastError='Execution timing persistence unavailable; buffered observations may be lost.';}
      })().finally(()=>{pending=null;});return pending;
    },
    start(){if(enabled&&!timer&&!stopped){timer=setInterval(()=>{void this.flush();},5000);timer.unref();}},
    async stop(){clearInterval(timer);stopped=true;await pending;while(rows.length){const before=rows.length;await this.flush();if(rows.length===before)break;}},
  };
}
