import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { migrate } from '../packages/database/src/migrations.js';
test('mapping and practical changes commit audit/cases atomically and preserve graded history',async()=>{
 const db=new PGlite();
 try{
 await migrate({query:async(q,p)=>(await db.query(q,p)).rows,apply:m=>db.transaction(async tx=>{for(const s of m.statements)await tx.exec(s);await tx.query('INSERT INTO coderank_migrations(name,checksum) VALUES($1,$2)',[m.name,m.checksum]);})},new URL('../database/migrations/',import.meta.url));
 await db.exec("INSERT INTO users(name,email,password,role) VALUES('Admin','a@test','x','admin'),('Faculty','f@test','x','faculty'),('Student','s@test','x','student'); INSERT INTO courses(course_code,name,semester) VALUES('CS','CS',1)");
 const mapping=(ids,co=2)=>db.query('SELECT coderank_replace_mapping(1,1,$1::int[],$2)',[ids,co]);
 await mapping([2]);await assert.rejects(mapping([3],3));
 assert.equal((await db.query('SELECT faculty_id FROM course_faculty')).rows[0].faculty_id,2);
 await assert.rejects(mapping([2,2]));
 const body={course_id:1,title:'Test',description:'Description',test_cases:[{input:'',expected:'ok',marks:10}]};
 const mutate=async(action,payload=body,id=1,actor=2)=>(await db.query('SELECT coderank_mutate_practical($1,$2,$3,$4::jsonb) p',[actor,id,action,JSON.stringify(payload)])).rows[0].p;
 const created=await mutate('create',body,null);assert.equal(created.total_marks,10);
 await assert.rejects(mutate('create',{...body,test_cases:[{input:'',expected:null,marks:10}]},null));
 assert.equal((await db.query('SELECT count(*)::int n FROM practicals')).rows[0].n,1);
 await assert.rejects(mutate('update',body,1,3));
 const tc=(await db.query('SELECT id FROM practical_test_cases')).rows[0].id;
 await db.query("SELECT coderank_save_attempt('grade',3,1,'code','python','Accepted',10,10,1,false,now(),$1::jsonb,'{}'::jsonb)",[JSON.stringify([{test_case_id:tc,passed:true,marks_awarded:10,execution_time_ms:1}])]);
 await assert.rejects(mutate('update',{...body,test_cases:[{input:'',expected:'changed',marks:10}]}),/immutable/);
 const updated=await mutate('update',{...body,title:'Renamed'});assert.equal(updated.title,'Renamed');
 assert.equal((await db.query('SELECT id FROM practical_test_cases')).rows[0].id,tc);
 const extended=await mutate('extend',{extraMinutes:5});assert.ok(new Date(extended.end_time)>new Date());
 await assert.rejects(mutate('extend',{extraMinutes:-1}));
 await mutate('delete',{});
 assert.equal((await db.query('SELECT status FROM practicals')).rows[0].status,'inactive');
 assert.equal((await db.query('SELECT count(*)::int n FROM practical_submission_cases')).rows[0].n,1);
 const actions=(await db.query('SELECT action FROM activity_logs')).rows.map(r=>r.action);
 assert.deepEqual(actions,['UPDATE_MAPPING','CREATE_PRACTICAL','UPDATE_PRACTICAL','EXTEND_PRACTICAL','DELETE_PRACTICAL']);
 }finally{await db.close();}
});
