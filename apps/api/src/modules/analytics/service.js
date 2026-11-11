import sql from '@coderank/database';
import { SubmissionService } from '@coderank/core/submissions';
import { checkDatabaseReadiness } from '@coderank/database/readiness';
import { withTimeout } from '@coderank/core/shared/timeout';
import { OperationsService } from '../operations/operations.service.js';

export const analyticsQuery = (text,params=[])=>sql.query(text,params);
const invalid = message => Object.assign(new Error(message),{statusCode:400});
const selected = `s.id::text AS id,s.student_id,u.name AS student,s.practical_id,p.title AS practical,c.course_code AS course,s.language,s.status,s.normalized_marks,s.execution_time_ms,s.submitted_at`;

export function submissionFilters(input={}) {
  const page=Number(input.page ?? 1),days=Number(input.days ?? 7);
  if(!Number.isInteger(page)||page<1||page>200||![1,7,30].includes(days)) throw invalid('Use page 1–200 and a 1, 7 or 30 day range.');
  const language=String(input.language || ''), search=String(input.search || '').trim();
  if(language && !['python','cpp','c','java','javascript'].includes(language)) throw invalid('Unsupported language filter.');
  if(search.length>100) throw invalid('Search must be at most 100 characters.');
  return {page,days,language,search};
}

export function createAnalyticsService(query=analyticsQuery) {
  let cached=null, pending=null;
  return {
    async overview() {
      if(cached && Date.now()-cached.observedAt<5000) return cached;
      if(pending) return pending;
      pending=(async()=>{
        const startedAt=Date.now();
        const [schema,execution,academic]=await Promise.allSettled([
          withTimeout(checkDatabaseReadiness(query),4000),
          SubmissionService.getAnalyticsSnapshot(),
          withTimeout(query(`SELECT (SELECT count(*)::int FROM users WHERE role='student' AND status='active') AS students,
            (SELECT count(*)::int FROM practicals WHERE status='active') AS practicals,
            (SELECT count(*)::int FROM practical_submissions) AS latest_grades,
            (SELECT count(*)::int FROM submission_attempts WHERE submitted_at>=now()-interval '7 days') AS attempts_7d,
            (SELECT count(DISTINCT student_id)::int FROM submission_attempts WHERE submitted_at>=now()-interval '7 days') AS participating_students_7d`,[]),4000),
        ]);
        const metrics=OperationsService.snapshotHttpMetrics();
        const executionData=execution.status==='fulfilled'?{status:'measured',...execution.value}:{status:'unavailable',workers:[],availableSlots:null,occupiedSlots:null,queue:null};
        const alerts=[];
        if(schema.status!=='fulfilled'||!schema.value.healthy) alerts.push({severity:'critical',message:'Database schema readiness is unavailable or not current.'});
        if(executionData.status!=='measured') alerts.push({severity:'critical',message:'Execution queue telemetry is unavailable.'});
        else {
          if(executionData.healthyWorkers===0) alerts.push({severity:'critical',message:'No healthy execution worker is reporting.'});
          if(executionData.capacityStatus==='unknown') alerts.push({severity:'warning',message:'Execution capacity cannot be established from fresh worker measurements.'});
          if(executionData.queue.oldestWaitingMs>30000) alerts.push({severity:'warning',message:'The oldest waiting execution has been queued for over 30 seconds.'});
        }
        cached={observedAt:Date.now(),collectionStartedAt:startedAt,collectionDurationMs:Date.now()-startedAt,
          database:schema.status==='fulfilled'?schema.value:{healthy:false,schema:'unavailable'},execution:executionData,
          academic:academic.status==='fulfilled'?{status:'measured',...academic.value[0]}:{status:'unavailable'},
          http:{...metrics,scope:'This API process since its most recent restart. Percentiles use bounded recent samples.'},
          alerts,nodeVersion:process.version};
        return cached;
      })().finally(()=>{pending=null;});
      return pending;
    },
    async submissions(input) {
      const filters=submissionFilters(input),pattern=`%${filters.search.replace(/[\\%_]/g,'\\$&')}%`;
      const rows=await query(`SELECT ${selected},count(*) OVER()::int AS total FROM practical_submissions s
        JOIN users u ON u.id=s.student_id JOIN practicals p ON p.id=s.practical_id JOIN courses c ON c.id=p.course_id
        WHERE s.submitted_at>=now()-make_interval(days=>$1) AND ($2='' OR s.language=$2)
        AND ($3='' OR u.name ILIKE $4 OR p.title ILIKE $4 OR c.course_code ILIKE $4)
        ORDER BY s.submitted_at DESC,s.id DESC LIMIT 25 OFFSET $5`,[filters.days,filters.language,filters.search,pattern,(filters.page-1)*25]);
      return {rows:rows.map(({total,...row})=>row),total:rows[0]?.total ?? 0,page:filters.page,pageSize:25,filters,scope:'Latest recorded grade per student and practical; completed attempts are listed in the detail view.'};
    },
    async submission(id) {
      if(!/^[1-9]\d{0,9}$/.test(String(id))) throw invalid('Invalid submission ID.');
      const [record]=await query(`SELECT ${selected},left(convert_from(s.code,'UTF8'),65536) AS code,char_length(convert_from(s.code,'UTF8'))>65536 AS code_truncated,s.raw_marks,s.is_late
        FROM practical_submissions s JOIN users u ON u.id=s.student_id JOIN practicals p ON p.id=s.practical_id JOIN courses c ON c.id=p.course_id WHERE s.id=$1`,[id]);
      if(!record) throw Object.assign(new Error('Submission not found.'),{statusCode:404});
      const [cases,attempts]=await Promise.all([
        query(`SELECT test_case_id,passed,marks_awarded,execution_time_ms,left(actual_output,4000) AS actual_output,left(error_message,2000) AS error_message FROM practical_submission_cases WHERE submission_id=$1 ORDER BY test_case_id LIMIT 200`,[id]),
        query(`SELECT job_id,language,raw_marks,normalized_marks,submitted_at,completed_at FROM submission_attempts WHERE student_id=$1 AND practical_id=$2 ORDER BY submitted_at DESC LIMIT 50`,[record.student_id,record.practical_id]),
      ]);
      return {...record,cases,attempts,limits:{codeCharacters:65536,cases:200,recentAttempts:50},note:'Attempt timestamps show submission-to-persistence time, not a separately measured queue/execution breakdown.'};
    },
    async progress() {
      const [daily,languages,courses]=await Promise.all([
        query(`SELECT date_trunc('day',submitted_at) AS day,count(*)::int AS attempts,count(DISTINCT student_id)::int AS students,round(avg(normalized_marks),2) AS average_score FROM submission_attempts WHERE submitted_at>=now()-interval '30 days' GROUP BY 1 ORDER BY 1`,[]),
        query(`SELECT language,count(*)::int AS attempts,round(avg(normalized_marks),2) AS average_score FROM submission_attempts WHERE submitted_at>=now()-interval '30 days' GROUP BY language ORDER BY attempts DESC`,[]),
        query(`SELECT c.id,c.course_code,c.name,count(s.id)::int AS latest_grades,count(DISTINCT s.student_id)::int AS participating_students,round(avg(s.normalized_marks),2) AS average_score FROM courses c LEFT JOIN practicals p ON p.course_id=c.id LEFT JOIN practical_submissions s ON s.practical_id=p.id GROUP BY c.id,c.course_code,c.name ORDER BY latest_grades DESC LIMIT 50`,[]),
      ]);
      return {daily,languages,courses,scope:'Daily activity uses durable completed assessment attempts in the last 30 days. Course statistics use current latest grades. Scores are out of 10; this is not a visitor or live-user count.'};
    },
  };
}
