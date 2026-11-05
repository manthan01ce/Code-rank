import '@coderank/core/config/env';
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
 await migrate({query:async(q,p)=>(await client.query(q,p)).rows,apply:async m=>{await client.query('BEGIN');try{for(const s of m.statements)await client.query(s);await client.query('INSERT INTO coderank_migrations(name,checksum) VALUES($1,$2)',[m.name,m.checksum]);await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw e;}}},new URL('../../packages/database/migrations/',import.meta.url));
 await client.query("INSERT INTO users(name,email,password,role) VALUES('Student','s@test','x','student'); INSERT INTO courses(course_code,name,semester) VALUES('CS','CS',1); INSERT INTO practicals(faculty_id,course_id,title,total_marks,status) VALUES(1,1,'Test',10,'active'); INSERT INTO practical_test_cases(practical_id,input,expected,marks) VALUES(1,'','ok',10)");
 await Promise.all(Array.from({length:10},async(_,marks)=>{
 const c=await pool.connect();try{await c.query(`SET search_path TO ${schema},public`);await c.query("SELECT coderank_save_attempt($1,1,1,'source','python','Wrong Answer',$2,$2,1,false,now(),$3::jsonb,'{}'::jsonb)",[`job-${marks}`,marks,JSON.stringify([{test_case_id:1,passed:false,marks_awarded:marks,execution_time_ms:1}])]);}finally{c.release();}
 }));
 assert.equal((await client.query('SELECT count(*)::int n,max(normalized_marks)::int marks FROM practical_submissions')).rows[0].n,1);
 assert.equal((await client.query('SELECT normalized_marks::int marks FROM practical_submissions')).rows[0].marks,9);
 assert.equal((await client.query('SELECT marks_awarded::int marks FROM practical_submission_cases')).rows[0].marks,9);
 }finally{await client.query(`DROP SCHEMA ${schema} CASCADE`);client.release();await pool.end();}
});

// These checks use the public native database client and real PostgreSQL, never
// PGlite or module mocks. Each run owns a fresh schema and removes only that schema.
test('public core entries preserve native actor ordering, sessions, readiness and attempt persistence', async () => {
  if (!process.env.TEST_DATABASE_URL) throw Error('TEST_DATABASE_URL must point at an isolated test database');
  const { randomUUID } = await import('node:crypto');
  const { default: sql, closeDatabase } = await import('@coderank/database');
  const { checkDatabaseReadiness } = await import('@coderank/database/readiness');
  const { UserManagementService } = await import('../../apps/api/src/modules/users/user-management.service.js');
  const { AuthService } = await import('../../apps/api/src/modules/auth/auth.service.js');
  const { authenticateToken } = await import('@coderank/core/security/active-actor');
  const { hashPassword } = await import('@coderank/core/utils/auth');
  const { saveAttempt, findAttempt } = await import('../../packages/core/src/modules/submissions/SubmissionRepository.js');
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, connectionTimeoutMillis: 2000 });
  const schema = 'core_facades_' + randomUUID().replaceAll('-', '');
  const prior = { DATABASE_URL: process.env.DATABASE_URL, DATABASE_DRIVER: process.env.DATABASE_DRIVER };
  let created = false;
  try {
    await pool.query(`CREATE SCHEMA ${schema}`); created = true;
    const url = new URL(process.env.TEST_DATABASE_URL);
    url.searchParams.set('options', `-c search_path=${schema}`);
    process.env.DATABASE_URL = url.href; process.env.DATABASE_DRIVER = 'postgres';
    for (const entry of ['@coderank/core/practicals', '@coderank/core/submissions', '@coderank/core/grading']) await import(entry);
    const query = (text, values = []) => sql.query(text, values);
    assert.deepEqual(await checkDatabaseReadiness(query), { healthy: false, schema: 'missing' });
    assert.equal((await query("SELECT to_regclass('coderank_migrations') AS ledger"))[0].ledger, null, 'imports/readiness must not create a ledger');
    const adapter = {
      query,
      apply: migration => sql.transaction(tx => [
        ...migration.statements.map(text => tx.query(text)),
        tx.query('INSERT INTO coderank_migrations(name,checksum) VALUES($1,$2)', [migration.name, migration.checksum]),
      ]),
    };
    const directory = new URL('../../packages/database/migrations/', import.meta.url);
    assert.ok((await migrate(adapter, directory)).length > 0);
    const ledger = await query('SELECT name,checksum FROM coderank_migrations ORDER BY name');
    assert.deepEqual(await migrate({ query, apply: () => assert.fail('Migration must not replay') }, directory), []);
    assert.deepEqual(await checkDatabaseReadiness(query), { healthy: true, schema: 'current' });
    await query('UPDATE coderank_migrations SET checksum=$1 WHERE name=$2', ['synthetic-drift', ledger[0].name]);
    assert.deepEqual(await checkDatabaseReadiness(query), { healthy: false, schema: 'mismatch' });
    assert.equal((await query('SELECT checksum FROM coderank_migrations WHERE name=$1', [ledger[0].name]))[0].checksum, 'synthetic-drift', 'readiness cannot repair the ledger');
    await query('UPDATE coderank_migrations SET checksum=$1 WHERE name=$2', [ledger[0].checksum, ledger[0].name]);
    await query("INSERT INTO users(name,email,password,role) VALUES('Admin','admin@core.test','x','admin'),('Faculty','faculty@core.test','x','faculty'),('Student','student@core.test',$1,'student')", [await hashPassword('native-session-test-password')]);
    await query("INSERT INTO courses(course_code,name,semester) VALUES('CORE','Core',1)");
    await query('SELECT coderank_replace_mapping(1,1,ARRAY[2],2)');
    // The actor-setting command must finish before the mutation executes on the
    // same native transaction connection; a later error must roll everything back.
    const body = JSON.stringify({ course_id: 1, title: 'Native', description: 'Synthetic fixture', test_cases: [{ input: '', expected: 'ok', marks: 10 }] });
    const transaction = title => sql.transaction(tx => [
      tx.query("SELECT set_config('coderank.test_actor',$1,true)", ['2']),
      tx.query("SELECT coderank_mutate_practical(current_setting('coderank.test_actor')::integer,NULL,'create',$1::jsonb) AS item", [title]),
    ]);
    const [, rows] = await transaction(body);
    const practical = rows[0].item;
    assert.equal(practical.faculty_id, 2);
    assert.equal((await query("SELECT user_id FROM activity_logs WHERE action='CREATE_PRACTICAL'"))[0].user_id, 2);
    await assert.rejects(sql.transaction(tx => [
      tx.query("SELECT set_config('coderank.test_actor',$1,true)", ['2']),
      tx.query("SELECT coderank_mutate_practical(current_setting('coderank.test_actor')::integer,NULL,'create',$1::jsonb)", [body]),
      tx.query('SELECT 1/0'),
    ]), error => error.code === '22012');
    assert.equal((await query('SELECT count(*)::int n FROM practicals'))[0].n, 1);
    await assert.rejects(query("SELECT coderank_mutate_practical(3,NULL,'create',$1::jsonb)", [body]), error => error.code === '42501');
    await UserManagementService.mutate({ id: 1, role: 'admin' }, 3, 'update', { name: 'Updated student' });
    assert.equal((await query('SELECT name FROM users WHERE id=3'))[0].name, 'Updated student');
    assert.equal((await query('SELECT name FROM users WHERE id=1'))[0].name, 'Admin');
    assert.equal((await query("SELECT user_id FROM activity_logs WHERE action='UPDATE_USER'"))[0].user_id, 1, 'API actor must precede target in the database call');
    const login = await AuthService.login({ email: 'student@core.test', password: 'native-session-test-password' });
    assert.equal((await authenticateToken(login.token)).id, 3);
    await query("UPDATE users SET status='inactive' WHERE id=3");
    await assert.rejects(authenticateToken(login.token), error => error.status === 401);
    await query("UPDATE users SET status='active',session_token='rotated' WHERE id=3");
    await assert.rejects(authenticateToken(login.token), error => error.status === 401);
    const [{ id: caseId }] = await query('SELECT id FROM practical_test_cases WHERE practical_id=$1', [practical.id]);
    const attempt = {
      jobId: 'native-core-attempt', userId: 3, dbId: practical.id, code: 'synthetic source', language: 'python',
      status: 'Accepted', rawMarks: 10, normalizedMarks: 10, totalTime: 1, isLate: false, submittedAt: new Date(),
      cases: [{ test_case_id: caseId, passed: true, marks_awarded: 10, actual_output: 'ok', execution_time_ms: 1 }], result: { status: 'accepted' },
    };
    const outcome = await saveAttempt(attempt);
    assert.equal(Number(outcome.normalizedMarks), 10);
    assert.deepEqual(await findAttempt(attempt), outcome);
    assert.deepEqual(await saveAttempt(attempt), outcome, 'same job must replay its ledger result');
    await assert.rejects(saveAttempt({ ...attempt, code: 'conflicting identity' }), /identity conflicts/);
    await assert.rejects(saveAttempt({ ...attempt, jobId: 'invalid-case', cases: [{ ...attempt.cases[0], test_case_id: caseId + 10000 }] }), /Test cases changed/);
    assert.equal((await query('SELECT count(*)::int n FROM submission_attempts'))[0].n, 1);
    assert.equal((await query('SELECT count(*)::int n FROM practical_submission_cases'))[0].n, 1);
    assert.equal(Number((await query('SELECT normalized_marks FROM practical_submissions'))[0].normalized_marks), 10);
    assert.deepEqual(await query('SELECT name,checksum FROM coderank_migrations ORDER BY name'), ledger);
    assert.deepEqual(await checkDatabaseReadiness(query), { healthy: true, schema: 'current' });
  } finally {
    await closeDatabase();
    for (const [name, value] of Object.entries(prior)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
    try { if (created) await pool.query(`DROP SCHEMA ${schema} CASCADE`); } finally { await pool.end(); }
  }
});
