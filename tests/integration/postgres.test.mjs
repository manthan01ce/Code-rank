import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { migrate } from '../../packages/database/src/migrations.js';
test('concurrent PostgreSQL attempts preserve one best grade and matching cases',async()=>{
 if(!process.env.TEST_DATABASE_URL)throw Error('TEST_DATABASE_URL must point at an isolated test database');
 const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL});
 const schema=`coderank_test_${Date.now()}`;
 const client=await pool.connect();
 try{
 await client.query(`CREATE SCHEMA ${schema}`);await client.query(`SET search_path TO ${schema},public`);
 await migrate({query:async(q,p)=>(await client.query(q,p)).rows,apply:async m=>{await client.query('BEGIN');try{for(const s of m.statements)await client.query(s);await client.query('INSERT INTO coderank_migrations(name,checksum) VALUES($1,$2)',[m.name,m.checksum]);await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw e;}}},new URL('../../database/migrations/',import.meta.url));
 await client.query("INSERT INTO users(name,email,password,role) VALUES('Student','s@test','x','student'); INSERT INTO courses(course_code,name,semester) VALUES('CS','CS',1); INSERT INTO practicals(faculty_id,course_id,title,total_marks,status) VALUES(1,1,'Test',10,'active'); INSERT INTO practical_test_cases(practical_id,input,expected,marks) VALUES(1,'','ok',10)");
 await Promise.all(Array.from({length:10},async(_,marks)=>{
 const c=await pool.connect();try{await c.query(`SET search_path TO ${schema},public`);await c.query("SELECT coderank_save_attempt($1,1,1,'source','python','Wrong Answer',$2,$2,1,false,now(),$3::jsonb,'{}'::jsonb)",[`job-${marks}`,marks,JSON.stringify([{test_case_id:1,passed:false,marks_awarded:marks,execution_time_ms:1}])]);}finally{c.release();}
 }));
 assert.equal((await client.query('SELECT count(*)::int n,max(normalized_marks)::int marks FROM practical_submissions')).rows[0].n,1);
 assert.equal((await client.query('SELECT normalized_marks::int marks FROM practical_submissions')).rows[0].marks,9);
 assert.equal((await client.query('SELECT marks_awarded::int marks FROM practical_submission_cases')).rows[0].marks,9);
 }finally{await client.query(`DROP SCHEMA ${schema} CASCADE`);client.release();await pool.end();}
});
