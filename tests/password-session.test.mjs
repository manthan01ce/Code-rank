import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
process.env.JWT_SECRET='password-session-test-secret';
const db=new PGlite();
let beforeWrite;
const sql=Object.assign(async(strings,...values)=>{
 let query=strings[0];for(let i=0;i<values.length;i++)query+=`$${i+1}`+strings[i+1];
 return (await db.query(query,values)).rows;
},{query:async(q,p)=>{if(beforeWrite){const hook=beforeWrite;beforeWrite=null;await hook();}return (await db.query(q,p)).rows;}});
mock.module(new URL('../packages/core/src/db/client.js',import.meta.url).href,{defaultExport:sql});
const {UserService}=await import('../packages/core/src/services/UserService.js');
const {hashPassword,comparePassword}=await import('../packages/core/src/utils/auth.js');
const {authenticateToken}=await import('../packages/core/src/security/active-actor.js');

test('self-service password changes rotate sessions atomically and reject concurrent session changes',async()=>{
 try {
  await db.exec("CREATE TABLE users(id int primary key,name text,email text unique,password text,role text,status text,session_token text,extra_info jsonb); CREATE TABLE activity_logs(id serial primary key,user_id int,action text,details text)");
  await db.query("INSERT INTO users VALUES(1,'Student','s@test.io',$1,'student','active','original','{}')",[await hashPassword('old-password')]);
  let actor={id:1,role:'student',session_token:'original'};
  assert.equal((await UserService.getProfile(actor)).session_token,undefined);
  for(const body of [{currentPassword:'old-password',newPassword:'short'}, {currentPassword:'old-password',newPassword:'😀'.repeat(19)}, {currentPassword:{},newPassword:'new-password'}]) {
   await assert.rejects(UserService.changePassword(actor,body),e=>e.status===400);
  }
  await assert.rejects(UserService.changePassword(actor,{currentPassword:'wrong',newPassword:'new-password'}),e=>e.status===400);
  const result=await UserService.changePassword(actor,{currentPassword:'old-password',newPassword:'new-password'});
  assert.ok(result.token);
  let current=await authenticateToken(result.token);
  assert.notEqual(current.session_token,'original');
  assert.ok(await comparePassword('new-password',(await db.query('SELECT password FROM users')).rows[0].password));
  await assert.rejects(UserService.changePassword(actor,{currentPassword:'new-password',newPassword:'another-password'}),e=>e.status===401);
  const profileChange=await UserService.updateProfile(current,{name:'Updated',email:'ignored@test.io',currentPassword:'new-password',newPassword:'profile-password'});
  await assert.rejects(authenticateToken(result.token),e=>e.status===401);
  actor=await authenticateToken(profileChange.token);
  assert.equal(actor.name,'Updated');assert.equal(actor.email,'s@test.io');
  const profileOnly=await UserService.updateProfile(actor,{name:'Profile Only'});
  assert.equal(profileOnly.token,undefined);
  assert.equal((await authenticateToken(profileChange.token)).session_token,actor.session_token);
  const snapshot=(await db.query('SELECT * FROM users')).rows[0];
  await db.exec("CREATE FUNCTION reject_self_audit() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'audit unavailable'; END$$; CREATE TRIGGER reject_self_audit BEFORE INSERT ON activity_logs FOR EACH ROW EXECUTE FUNCTION reject_self_audit()");
  await assert.rejects(UserService.changePassword(actor,{currentPassword:'profile-password',newPassword:'rollback-password'}),/audit unavailable/);
  assert.deepEqual((await db.query('SELECT * FROM users')).rows[0],snapshot);
  await db.exec('DROP TRIGGER reject_self_audit ON activity_logs');
  beforeWrite=()=>db.query("UPDATE users SET session_token='concurrent-login' WHERE id=1");
  await assert.rejects(UserService.changePassword(actor,{currentPassword:'profile-password',newPassword:'race-password'}),e=>e.status===401);
  const raced=(await db.query('SELECT * FROM users')).rows[0];
  assert.equal(raced.password,snapshot.password);assert.equal(raced.session_token,'concurrent-login');
  assert.equal((await db.query('SELECT count(*)::int n FROM activity_logs')).rows[0].n,3);
 }finally{await db.close();}
});
