import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { migrate } from '../packages/database/src/migrations.js';

test('catalog mutations preserve history, department references and audit atomicity', async () => {
 const db = new PGlite();
 try {
  await migrate({ query: async(q,p)=>(await db.query(q,p)).rows, apply: m=>db.transaction(async tx=>{ for(const s of m.statements) await tx.exec(s); await tx.query('INSERT INTO coderank_migrations(name,checksum) VALUES($1,$2)',[m.name,m.checksum]); }) },new URL('../database/migrations/',import.meta.url));
  await db.exec("INSERT INTO users(name,email,password,role,extra_info) VALUES('Admin','admin@test','x','admin','{}'),('Faculty','faculty@test','x','faculty','{\"department\":\"CE\",\"other\":true}')");
  const mutate = async(entity,id,action,body={},actor=1)=>(await db.query('SELECT coderank_manage_catalog($1,$2,$3,$4,$5::jsonb) item',[actor,entity,id,action,JSON.stringify(body)])).rows[0].item;
  const course=await mutate('course',null,'create',{name:' CS ',course_code:'CS1',semester:1});
  assert.equal(course.name,'CS');
  await assert.rejects(mutate('course',null,'create',{name:'Dup',course_code:'CS1',semester:1}),e=>e.code==='23505');
  await assert.rejects(mutate('course',course.id,'update',{name:'Bad',course_code:'CS1',semester:'1oops'}),e=>e.code==='22023');
  await assert.rejects(mutate('course',course.id,'update',{name:'Bad',course_code:'CS1',semester:1},2),e=>e.code==='42501');
  await assert.rejects(mutate('course',9999,'delete'),e=>e.code==='P0002');
  await db.exec(`INSERT INTO course_faculty VALUES(${course.id},2,true); INSERT INTO practicals(faculty_id,course_id,title) VALUES(2,${course.id},'Exam')`);
  await assert.rejects(mutate('course',course.id,'delete'),e=>e.code==='23503');
  assert.equal((await db.query('SELECT count(*)::int n FROM practicals')).rows[0].n,1);
  const empty=await mutate('course',null,'create',{name:'Empty',course_code:'EMPTY',semester:2});
  await db.exec(`INSERT INTO course_faculty VALUES(${empty.id},2,true)`);
  await mutate('course',empty.id,'delete');
  assert.equal((await db.query('SELECT count(*)::int n FROM course_faculty WHERE course_id=$1',[empty.id])).rows[0].n,0);
  const dept=await mutate('department',null,'create',{name:'CE',institute_name:'College'});
  await assert.rejects(mutate('department',dept.id,'delete'),e=>e.code==='23503');
  await mutate('department',dept.id,'update',{name:'Computer',institute_name:'College'});
  assert.deepEqual((await db.query('SELECT extra_info FROM users WHERE id=2')).rows[0].extra_info,{department:'Computer',other:true});
  const removable=await mutate('course',null,'create',{name:'Keep',course_code:'KEEP',semester:1});
  const freeDepartment=await mutate('department',null,'create',{name:'Free',institute_name:'College'});
  await db.exec(`INSERT INTO course_faculty VALUES(${removable.id},2,true)`);
  const before=(await db.query('SELECT count(*)::int n FROM activity_logs')).rows[0].n;
  await db.exec("CREATE FUNCTION reject_catalog_audit() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'audit unavailable'; END$$; CREATE TRIGGER reject_catalog_audit BEFORE INSERT ON activity_logs FOR EACH ROW EXECUTE FUNCTION reject_catalog_audit()");
  await assert.rejects(mutate('course',removable.id,'delete'),/audit unavailable/);
  await assert.rejects(mutate('department',freeDepartment.id,'delete'),/audit unavailable/);
  assert.equal((await db.query('SELECT count(*)::int n FROM course_faculty WHERE course_id=$1',[removable.id])).rows[0].n,1);
  assert.equal((await db.query('SELECT count(*)::int n FROM departments WHERE id=$1',[freeDepartment.id])).rows[0].n,1);
  await assert.rejects(mutate('department',dept.id,'update',{name:'Broken',institute_name:'College'}),/audit unavailable/);
  assert.equal((await db.query('SELECT name FROM departments WHERE id=$1',[dept.id])).rows[0].name,'Computer');
  assert.equal((await db.query('SELECT extra_info FROM users WHERE id=2')).rows[0].extra_info.department,'Computer');
  await assert.rejects(mutate('course',null,'create',{name:'Lost',course_code:'LOST',semester:1}),/audit unavailable/);
  assert.equal((await db.query("SELECT count(*)::int n FROM courses WHERE course_code='LOST'")).rows[0].n,0);
  await assert.rejects(mutate('course',course.id,'update',{name:'Broken',course_code:'CS1',semester:3}),/audit unavailable/);
  assert.equal((await db.query('SELECT name FROM courses WHERE id=$1',[course.id])).rows[0].name,'CS');
  assert.equal((await db.query('SELECT count(*)::int n FROM activity_logs')).rows[0].n,before);
  await db.exec('DROP TRIGGER reject_catalog_audit ON activity_logs; UPDATE users SET status=\'inactive\' WHERE id=1');
  await assert.rejects(mutate('department',dept.id,'delete'),e=>e.code==='42501');
 } finally { await db.close(); }
});
