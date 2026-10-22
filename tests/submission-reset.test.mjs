import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { migrate } from '../packages/database/src/migrations.js';
test('reset authorizes current mapping atomically and rolls back deletion when audit fails',async()=>{
 const db=new PGlite();
 try{
 await migrate({query:async(q,p)=>(await db.query(q,p)).rows,apply:m=>db.transaction(async tx=>{for(const s of m.statements)await tx.exec(s);await tx.query('INSERT INTO coderank_migrations(name,checksum) VALUES($1,$2)',[m.name,m.checksum]);})},new URL('../database/migrations/',import.meta.url));
 await db.exec("INSERT INTO users(name,email,password,role) VALUES('Admin','a@test','x','admin'),('Assigned','f@test','x','faculty'),('Old author','o@test','x','faculty'),('Student','s@test','x','student'); INSERT INTO courses(course_code,name,semester) VALUES('CS','CS',1); INSERT INTO course_faculty VALUES(1,2,true); INSERT INTO practicals(faculty_id,course_id,title) VALUES(3,1,'Test'); INSERT INTO practical_test_cases(practical_id,input,expected,marks) VALUES(1,'','ok',10); SELECT coderank_save_attempt('job',4,1,'code','python','Accepted',10,10,1,false,now(),'[{\"test_case_id\":1,\"passed\":true,\"marks_awarded\":10,\"execution_time_ms\":1}]'::jsonb,'{}'::jsonb); INSERT INTO student_workspaces VALUES(4,1,'python',convert_to('source','UTF8'),now())");
 await assert.rejects(db.query('SELECT coderank_reset_submission(3,1)'),/assignment/);
 await assert.rejects(db.query('SELECT coderank_reset_submission(4,1)'),/faculty/);
 await db.exec("CREATE FUNCTION reject_reset_audit() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'audit unavailable'; END$$; CREATE TRIGGER reject_reset BEFORE INSERT ON activity_logs FOR EACH ROW EXECUTE FUNCTION reject_reset_audit()");
 await assert.rejects(db.query('SELECT coderank_reset_submission(2,1)'),/audit unavailable/);
 for(const table of ['practical_submissions','practical_submission_cases','student_workspaces'])assert.equal((await db.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n,1);
 await db.exec('DROP TRIGGER reject_reset ON activity_logs');
 await db.query('SELECT coderank_reset_submission(2,1)');
 assert.equal((await db.query('SELECT count(*)::int n FROM practical_submissions')).rows[0].n,0);
 assert.equal((await db.query('SELECT count(*)::int n FROM submission_attempts')).rows[0].n,1);
 assert.equal((await db.query("SELECT count(*)::int n FROM activity_logs WHERE action='RESET_SUBMISSION'")).rows[0].n,1);
 }finally{await db.close();}
});
