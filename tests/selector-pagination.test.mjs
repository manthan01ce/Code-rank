import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { listPage } from '../packages/core/src/modules/courses/list-pagination.js';
const db = new PGlite();
const sql = (strings, ...params) => db.query(strings.reduce((q, s, i) => q + s + (i < params.length ? `$${i + 1}` : ''), ''), params).then(r => r.rows);
mock.module(new URL('../packages/core/src/db/client.js', import.meta.url).href, { defaultExport: sql });
mock.module('redis', { namedExports: { createClient: () => ({ on() {}, connect: async () => { throw Error('offline'); }, destroy() {} }) } });
const { CourseService: service } = await import('../packages/core/src/modules/courses/CourseService.js');
test('selector pagination rejects invalid bounds and cursors', () => {
  for (const limit of [0, -1, 501, 1.2, 'bad']) assert.throws(() => listPage({ limit }));
  for (const cursor of ['-1', '1x', '0', '999999999999999999']) assert.throws(() => listPage({ cursor }));
  assert.deepEqual(listPage({ cursor: '9', limit: '2' }), { cursor: 9, limit: 2 });
});
test('course, department, faculty and batch selectors traverse complete nonoverlapping SQL pages', async () => {
  try {
    await db.exec(`CREATE TABLE courses(id serial PRIMARY KEY, course_code text, name text, semester integer);
      CREATE TABLE departments(id serial PRIMARY KEY, name text, institute_name text);
      CREATE TABLE course_faculty(course_id integer, faculty_id integer, is_co_coordinator boolean);
      CREATE TABLE users(role text, status text, extra_info jsonb);
      INSERT INTO courses(course_code,name,semester) VALUES ('C1','Match',1),('C2','Match',2),('C3','Match',1),('C4','Match',1),('C5','Other',1);
      INSERT INTO departments(name,institute_name) SELECT 'D'||i,'Institute' FROM generate_series(1,5) i;
      INSERT INTO course_faculty SELECT id,7,true FROM courses;
      INSERT INTO users SELECT 'student','active',jsonb_build_object('batch','B'||i) FROM generate_series(1,5) i;
      INSERT INTO users VALUES('student','inactive','{"batch":"Excluded"}'),('student','active','{"batch":"B1"}');`);
    const admin = { id: 1, role: 'admin' };
    async function collect(method, user, extra = {}, strings = false) {
      const all = []; let cursor;
      do {
        const rows = await method(user, { ...extra, cursor, limit: 2 });
        assert.ok(rows.length <= 2); all.push(...rows);
        cursor = rows.length === 2 ? (strings ? rows.at(-1) : rows.at(-1).id) : null;
      } while(cursor);
      return all;
    }
    const courses = await collect(service.listCourses, admin, { search: 'Match', semester: '1' });
    assert.deepEqual(courses.map(r => r.id), [4,3,1]);
    const departments = await collect(service.listDepartments, admin, { search: 'Institute' });
    assert.deepEqual(departments.map(r => r.id), [5,4,3,2,1]);
    const faculty = await collect(service.getFacultyCourses, { id:7, role:'faculty' });
    assert.deepEqual(faculty.map(r => r.id), [5,4,3,2,1]);
    assert.deepEqual(await collect(service.getBatches, admin, {}, true), ['B5','B4','B3','B2','B1']);
    await assert.rejects(service.listCourses(admin, { semester: 'bad' }), e => e.status === 400);
    await assert.rejects(service.listDepartments({ role: 'student' }), e => e.status === 401);
  } finally { await db.close(); }
});
