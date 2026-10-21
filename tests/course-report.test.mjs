import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { migrate } from "../packages/database/src/migrations.js";
const db = new PGlite();
const query = async (q, p) => (await db.query(q, p)).rows;
mock.module(
  new URL("../packages/core/src/db/client.js", import.meta.url).href,
  { defaultExport: { query } },
);
const { CourseReportService: service } = await import(
  "../packages/core/src/modules/reports/CourseReportService.js"
);
test("marks matrix bounds both dimensions, ignores malformed semesters and scopes grades", async () => {
  try {
    await migrate(
      {
        query,
        apply: (m) =>
          db.transaction(async (tx) => {
            for (const s of m.statements) await tx.exec(s);
            await tx.query(
              "INSERT INTO coderank_migrations(name,checksum) VALUES($1,$2)",
              [m.name, m.checksum],
            );
          }),
      },
      new URL("../database/migrations/", import.meta.url),
    );
    await db.exec(
      "INSERT INTO users(name,email,password,role) VALUES('Faculty','f@test','x','faculty'); INSERT INTO courses(course_code,name,semester) VALUES('CS','CS',1); INSERT INTO course_faculty VALUES(1,1,true)",
    );
    for (let i = 0; i < 5; i++)
      await query(
        "INSERT INTO users(name,email,password,role,extra_info) VALUES('Student',$1,'x','student',$2::jsonb)",
        [
          `s${i}@test`,
          JSON.stringify({
            semester: i === 4 ? "bad" : "1",
            department: i % 2 ? "IT" : "CE",
          }),
        ],
      );
    for (let i = 0; i < 3; i++)
      await query(
        "INSERT INTO practicals(faculty_id,course_id,title) VALUES(1,1,$1)",
        ["P" + i],
      );
    await db.exec(
      "INSERT INTO practical_submissions(student_id,practical_id,code,language,status,normalized_marks) SELECT u.id,p.id,convert_to('code','UTF8'),'python','Accepted',10 FROM users u CROSS JOIN practicals p WHERE u.role='student'",
    );
    const params = new URLSearchParams({ limit: "2", practicalLimit: "2" }),
      user = { id: 1, role: "faculty" };
    const first = await service.marks(user, 1, params);
    assert.equal(first.students.length, 2);
    assert.equal(first.practicals.length, 2);
    assert.equal(first.submissions.length, 4);
    params.set("studentCursor", first.pagination.studentCursor);
    params.set("practicalCursor", first.pagination.practicalCursor);
    const second = await service.marks(user, 1, params);
    assert.equal(second.students.length, 2);
    assert.equal(second.practicals.length, 1);
    assert.equal(second.submissions.length, 2);
    assert.ok(
      !first.students.some((a) => second.students.some((b) => a.id === b.id)),
    );
    const filtered = await service.marks(
      user,
      1,
      new URLSearchParams({ department: "IT" }),
    );
    assert.equal(filtered.students.length, 2);
    assert.ok(filtered.students.every((s) => s.department === "IT"));
    await assert.rejects(
      service.marks({ id: 99, role: "faculty" }, 1),
      (e) => e.status === 404,
    );
    await assert.rejects(
      service.marks(user, 1, new URLSearchParams({ limit: "201" })),
      (e) => e.status === 400,
    );
  } finally {
    await db.close();
  }
});
