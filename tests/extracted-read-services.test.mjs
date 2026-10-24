import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
let queryCount=0;
const sql = Object.assign((strings, ...params) => db.query(strings.reduce((text, part, i) => text + part + (i < params.length ? `$${i + 1}` : ''), ''), params).then(result => result.rows), {
  query: async (query, params) => { queryCount++; return (await db.query(query, params)).rows; },
});
mock.module(new URL('../packages/core/src/db/client.js', import.meta.url).href, { defaultExport: sql });
const { StudentPracticalService } = await import('../packages/core/src/modules/practicals/StudentPracticalService.js');
const { PracticalReportService } = await import('../packages/core/src/modules/reports/PracticalReportService.js');
const { OperationsService } = await import('../packages/core/src/modules/reports/OperationsService.js');
const { SubmissionService } = await import('../packages/core/src/modules/submissions/SubmissionService.js');

test('extracted reads preserve cohort visibility, reporting authority, ordering and validation', async () => {
  try {
    await db.exec(`
      CREATE TABLE users(id int, name text, email text, role text, status text, extra_info jsonb, session_token text);
      CREATE TABLE courses(id int, name text, course_code text, semester int);
      CREATE TABLE course_faculty(course_id int, faculty_id int);
      CREATE TABLE practicals(id int, course_id int, faculty_id int, batch_id text, title text, description text, instructions text, total_marks numeric, difficulty text, is_challenge boolean, input_format text, output_format text, constraints text, sample_input text, sample_output text, starter_code text, start_time timestamp, end_time timestamp, status text, created_at timestamp);
      CREATE TABLE practical_submissions(id int, practical_id int, student_id int, raw_marks numeric, normalized_marks numeric, submitted_at timestamp, status text);
      CREATE TABLE activity_logs(id int, user_id int, action text, details text, created_at timestamp);
      INSERT INTO users VALUES
        (1,'Admin','a@test','admin','active','{}',null),
        (2,'Faculty','f@test','faculty','active','{}',null),
        (3,'Student','s@test','student','active','{"batch":"B_1","division":"CE1","semester":1}', 'session'),
        (4,'Other semester','o@test','student','active','{"division":"CE1","semester":2}',null),
        (5,'Bad metadata','bad@test','student','active','{"semester":"unknown"}',null);
      INSERT INTO courses VALUES (1,'CS','CS1',1);
      INSERT INTO course_faculty VALUES (1,2);
      INSERT INTO practicals(id,course_id,faculty_id,batch_id,title,total_marks,status,created_at) VALUES
        (1,1,2,' ce1 ','Division',100,'active','2026-01-01'),
        (2,1,2,' ALL ','All',100,'active','2026-01-02'),
        (3,1,2,'BX1','Other cohort',100,'active','2026-01-03'),
        (4,1,2,'CE1','Archived',100,'archived','2026-01-04');
      INSERT INTO practical_submissions VALUES(1,1,3,80,80,'2026-01-01','Accepted');
      INSERT INTO activity_logs VALUES (1,3,'LOGIN','first','2026-01-01'),(2,3,'LOGIN','second','2026-01-01');
    `);
    const student = { id: 3, role: 'student', session_token: 'session' };
    assert.deepEqual((await StudentPracticalService.list(student)).map(row => row.id), [2,1]);
    assert.equal((await StudentPracticalService.list(student, '1junk')).length, 0);
    assert.equal((await StudentPracticalService.list(student, 'CS1')).length, 2);
    await assert.rejects(StudentPracticalService.list({ ...student, session_token: 'revoked' }), error => error.status === 401);
    const before=queryCount;
    const report = await PracticalReportService.stats({ id: 2, role: 'faculty' }, 1);
    assert.equal(queryCount-before,1,'authorization, totals and grade page use exactly one statement');
    assert.equal(report.stats.total_students, 1);
    assert.equal(report.students[0].normalized_marks, 80);
    assert.equal((await PracticalReportService.stats({ id: 1, role: 'admin' }, 2)).stats.total_students, 1);
    await assert.rejects(PracticalReportService.stats({ id: 99, role: 'faculty' }, 1), error => error.status === 404);
    await assert.rejects(PracticalReportService.stats(student, 1), error => error.status === 401);
    for (const id of ['1junk', '-1', '0', 'NaN']) {
      await assert.rejects(PracticalReportService.stats({ role: 'admin' }, id), error => error.status === 400);
      await assert.rejects(SubmissionService.getSubmission(student, id), error => error.status === 400);
    }
    assert.deepEqual(await OperationsService.stats({ role: 'admin' }), { faculty: 1, students: 3, courses: 1 });
    assert.equal((await OperationsService.logs({ role: 'admin' }, '1'))[0].id, 2);
    for (const limit of ['1junk', '-1', '101', '1.5']) await assert.rejects(OperationsService.logs({ role: 'admin' }, limit), error => error.status === 400);
    await assert.rejects(OperationsService.logs(student), error => error.status === 401);
    // Multiple bounded pages, non-overlap, full totals, and no count queries
    // outside the report's single authorization snapshot.
    await db.exec(`INSERT INTO users(id,name,email,role,status,extra_info) SELECT n,'Student'||n,'s'||n||'@test','student','active','{"division":"CE1","semester":1}' FROM generate_series(100,229) n;
      INSERT INTO practicals(id,course_id,faculty_id,batch_id,title,total_marks,status,created_at)
      SELECT n,1,2,'All','Page'||n,100,'active',now() FROM generate_series(10,69) n;`);
    const found = []; let cursor = null;
    do {
      const page = await StudentPracticalService.list(student,null,{limit:10,cursor});
      assert.ok(page.length <= 10); found.push(...page.map(row => row.id));
      cursor = page.length === 10 ? String(page.at(-1).id) : null;
    } while(cursor);
    assert.equal(found.length,62); assert.equal(new Set(found).size,62);
    const grades=[]; cursor=null;
    do {
      const page = await PracticalReportService.stats({id:2,role:'faculty'},1,{limit:17,cursor});
      assert.equal(page.stats.total_students,131); assert.ok(page.students.length<=17);
      grades.push(...page.students.map(row => row.id)); cursor=page.pagination.nextCursor;
    } while(cursor);
    assert.equal(grades.length,131); assert.equal(new Set(grades).size,131);
    for (const options of [{limit:101},{limit:0},{cursor:'1junk'}]) {
      await assert.rejects(StudentPracticalService.list(student,null,options),error=>error.status===400);
      await assert.rejects(PracticalReportService.stats({id:2,role:'faculty'},1,options),error=>error.status===400);
    }
    await db.exec('DELETE FROM course_faculty');
    await assert.rejects(PracticalReportService.stats({id:2,role:'faculty'},1),error=>error.status===404);
    await db.exec("UPDATE users SET session_token='rotated' WHERE id=1");
    await assert.rejects(PracticalReportService.stats({id:1,role:'admin'},1),error=>error.status===404);
  } finally { await db.close(); }
});
