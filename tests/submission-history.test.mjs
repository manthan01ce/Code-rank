import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { migrate } from '../packages/database/src/migrations.js';
const db=new PGlite();
const sql=Object.assign(async()=>[],{query:async(q,p)=>(await db.query(q,p)).rows});
mock.module(new URL('../packages/core/src/db/client.js',import.meta.url).href,{defaultExport:sql});
const {SubmissionHistoryService:service,pageOptions}=await import('../packages/core/src/modules/submissions/SubmissionHistoryService.js');
test('submission keysets preserve ties and timestamp precision in every sort direction',async()=>{
 try{
 await migrate({query:sql.query,apply:m=>db.transaction(async tx=>{for(const s of m.statements)await tx.exec(s);await tx.query('INSERT INTO coderank_migrations(name,checksum) VALUES($1,$2)',[m.name,m.checksum]);})},new URL('../database/migrations/',import.meta.url));
 await db.exec("INSERT INTO users(name,email,password,role) VALUES('Faculty','f@test','x','faculty'); INSERT INTO courses(course_code,name,semester) VALUES('CS','CS',1); INSERT INTO course_faculty(course_id,faculty_id,is_co_coordinator) VALUES(1,1,true); INSERT INTO practicals(faculty_id,course_id,title) VALUES(1,1,'Test')");
 for(let i=0;i<7;i++){
  const [{id}]=await sql.query("INSERT INTO users(name,email,password,role) VALUES($1,$2,'x','student') RETURNING id",[i<4?'Same':'Zed',`s${i}@test`]);
  await sql.query("INSERT INTO practical_submissions(student_id,practical_id,code,language,status,raw_marks,normalized_marks,submitted_at) VALUES($1,1,convert_to('你好','UTF8'),'python','Accepted',$2,$2,$3)",[id,i%3,`2026-01-01T00:00:00.00000${i%2}Z`]);
 }
 for(const sort of ['marks','student_name','submission_time'])for(const direction of ['ASC','DESC']){
  const ids=[];let cursor=null;
  do{const params=new URLSearchParams({sortBy:sort,sortOrder:direction,limit:'2',...(cursor?{cursor}:{})});const page=await service.faculty({id:1,role:'faculty'},1,params);ids.push(...page.rows.map(r=>r.id));cursor=page.next;}while(cursor);
  assert.equal(ids.length,7,sort+direction);assert.equal(new Set(ids).size,7,sort+direction);
  const column={marks:'s.normalized_marks',student_name:'u.name',submission_time:'s.submitted_at'}[sort];
  const expected=await sql.query(`SELECT s.id FROM practical_submissions s JOIN users u ON u.id=s.student_id ORDER BY ${column} ${direction},${sort==='submission_time'?'':'s.submitted_at DESC,'}s.id DESC`,[]);
  assert.deepEqual(ids,expected.map(r=>r.id));
 }
 const own=await service.student({id:2,role:'student'},1,{limit:2,cursor:null});assert.equal(own.length,1);assert.equal(own[0].code,'你好');
 await assert.rejects(service.faculty({id:2,role:'faculty'},1,new URLSearchParams()),e=>e.status===404);
 await assert.rejects(service.faculty({id:1,role:'faculty'},1,new URLSearchParams({sortBy:'id; DROP TABLE users'})),e=>e.status===400);
 await assert.rejects(service.faculty({id:1,role:'faculty'},1,new URLSearchParams({cursor:'bad'})),e=>e.status===400);
 await assert.rejects(service.faculty({id:1,role:'faculty'},1,new URLSearchParams({fromDate:'bad'})),e=>e.status===400);
 assert.throws(()=>pageOptions(new URLSearchParams({limit:'201'})));
 }finally{await db.close();}
});
