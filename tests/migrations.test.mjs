import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { migrate, loadMigrations, LEDGER_SQL } from '../packages/database/src/migrations.js';
const directory = new URL('../database/migrations/', import.meta.url);
test('migrations and grading are transactional, idempotent and preserve best grades', async () => {
 const db = new PGlite();
 const adapter = { query: async (q,p) => (await db.query(q,p)).rows, apply: m => db.transaction(async tx => {
   for (const statement of m.statements) await tx.exec(statement);
   await tx.query('INSERT INTO coderank_migrations(name,checksum) VALUES($1,$2)',[m.name,m.checksum]);
 }) };
 try {
 assert.equal((await migrate(adapter,directory)).length,(await loadMigrations(directory)).length);
 assert.deepEqual(await migrate(adapter,directory),[]);
 await db.exec("INSERT INTO users(name,email,password,role) VALUES('Student','student@test','unused','student'); INSERT INTO courses(course_code,name,semester) VALUES('CS','CS',1);");
 await db.exec("INSERT INTO practicals(faculty_id,course_id,title,total_marks,status) VALUES(1,1,'Test',10,'active'); INSERT INTO practical_test_cases(practical_id,input,expected,marks) VALUES(1,'','ok',10);");
 const save = (id,marks,caseId=1,code='print(\"你好\")') => db.query('SELECT coderank_save_attempt($1,1,1,$2,\'python\',$3,$4,$4,1,false,now(),$5::jsonb,$6::jsonb) AS result',[id,code,marks===10?'Accepted':'Wrong Answer',marks,JSON.stringify([{test_case_id:caseId,passed:marks===10,marks_awarded:marks,actual_output:'ok',execution_time_ms:1}]),JSON.stringify({status:marks===10?'accepted':'wrong_answer'})]);
 const first = (await save('first',10)).rows[0].result;
 assert.deepEqual((await save('first',0)).rows[0].result,first);
 assert.equal((await save('worse',0)).rows[0].result.normalizedMarks,10);
 await assert.rejects(save('invalid',10,999));
 assert.equal((await db.query('SELECT count(*)::int AS n FROM submission_attempts')).rows[0].n,2);
 assert.equal((await db.query("SELECT convert_from(code,'UTF8') AS code FROM practical_submissions")).rows[0].code,'print("你好")');
 assert.equal((await db.query('SELECT count(*)::int AS n FROM practical_submission_cases')).rows[0].n,1);
 await assert.rejects(save('first',10,1,'different code'));
 await db.query('SELECT coderank_delete_submission(1,1)');
 await save('first',10);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM practical_submissions')).rows[0].n,0);
 await assert.rejects(db.query("SELECT coderank_save_attempt('old-queued',1,1,'code','python','Accepted',10,10,1,false,'2000-01-01','[]'::jsonb,'{}'::jsonb)"), /reset after/);
 await db.query("UPDATE coderank_migrations SET checksum='tampered' WHERE name='002_submission_attempts.sql'");
 await assert.rejects(migrate(adapter,directory), /Applied migration changed/);
 } finally { await db.close(); }
});

test('duplicate historic grades stop migration without partial schema changes', async () => {
 const db = new PGlite();
 const adapter = { query: async(q,p)=>(await db.query(q,p)).rows, apply: m=>db.transaction(async tx=>{
  for(const statement of m.statements) await tx.exec(statement);
  await tx.query('INSERT INTO coderank_migrations(name,checksum) VALUES($1,$2)',[m.name,m.checksum]);
 })};
 try {
 await db.exec(LEDGER_SQL);
 const migrations=await loadMigrations(directory);
 await adapter.apply(migrations[0]);await adapter.apply(migrations[1]);
 await db.exec("INSERT INTO users(name,email,password,role) VALUES('Student','s@test','unused','student'); INSERT INTO courses(course_code,name,semester) VALUES('CS','CS',1); INSERT INTO practicals(faculty_id,course_id,title) VALUES(1,1,'Test'); INSERT INTO practical_submissions(student_id,practical_id,code,language,status) VALUES(1,1,convert_to('code','UTF8'),'python','Accepted'),(1,1,convert_to('code2','UTF8'),'python','Wrong Answer');");
 await assert.rejects(migrate(adapter,directory), /Duplicate student/);
 assert.equal((await db.query("SELECT to_regclass('submission_attempts') AS table_name")).rows[0].table_name,null);
 assert.equal((await db.query('SELECT count(*)::int n FROM practical_submissions')).rows[0].n,2);
 assert.equal((await db.query('SELECT count(*)::int n FROM coderank_migrations')).rows[0].n,2);
 }finally{await db.close();}
});
