import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { migrate } from "../packages/database/src/migrations.js";
process.env.JWT_SECRET = "profile-test-secret";
const db = new PGlite();
const sql = Object.assign(
  async (strings, ...values) => {
    let text = strings[0];
    for (let i = 0; i < values.length; i++)
      text += `$${i + 1}` + strings[i + 1];
    return (await db.query(text, values)).rows;
  },
  { query: async (q, p) => (await db.query(q, p)).rows },
);
mock.module(
  new URL("../packages/core/src/db/client.js", import.meta.url).href,
  { defaultExport: sql },
);
const { UserService } = await import(
  "../packages/core/src/services/UserService.js"
);
test("profile history is bounded and excludes source/secret grading fields; handles are literal", async () => {
  try {
    await migrate(
      {
        query: sql.query,
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
      "INSERT INTO users(name,email,password,role) VALUES('Wrong','studentX1@test','secret','student'),('Student','student_1@test','secret','student'); INSERT INTO courses(course_code,name,semester) VALUES('CS','CS',1); INSERT INTO practicals(faculty_id,course_id,title) SELECT 1,1,'P'||n FROM generate_series(1,150) n; INSERT INTO practical_submissions(student_id,practical_id,code,language,status) SELECT 2,id,convert_to('private-source','UTF8'),'python','Accepted' FROM practicals",
    );
    const profile = await UserService.getStudentProfileByUsername("student_1");
    assert.equal(profile.user.id, 2);
    assert.equal(profile.submissions.length, 100);
    assert.equal(profile.user.password, undefined);
    assert.ok(
      profile.submissions.every(
        (s) => !("code" in s) && !("testcase_results" in s),
      ),
    );
    assert.ok(!JSON.stringify(profile).includes("private-source"));
    await assert.rejects(
      UserService.getStudentProfileByUsername("%"),
      (e) => e.status === 400,
    );
  } finally {
    await db.close();
  }
});
