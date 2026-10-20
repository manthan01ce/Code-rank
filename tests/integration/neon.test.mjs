import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import "../../packages/core/src/config/env.js";
import { neon } from "@neondatabase/serverless";
import { migrate } from "../../packages/database/src/migrations.js";

test("isolated Neon schema: migrations, concurrent grades and transactional administration", async () => {
  const url = process.env.NEON_TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!url || url.includes("placeholder"))
    throw Error("Configure a Neon database for isolated schema testing");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 480000);
  timer.unref();
  const client = neon(url, { fetchOptions: { signal: controller.signal } }),
    schema = "coderank_test_" + randomUUID().replaceAll("-", "");
  let created = false;
  const query = async (q, p = []) => {
    const results = await client.transaction(
      (tx) => [
        tx.query(`SET LOCAL search_path TO ${schema},public`),
        tx.query(q, p),
      ],
      {
        fetchOptions: {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(20000),
          ]),
        },
      },
    );
    return results.at(-1);
  };
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    created = true;
    await migrate(
      {
        query,
        apply: (m) =>
          client
            .transaction(
              (tx) => [
                tx.query(`SET LOCAL search_path TO ${schema},public`),
                ...m.statements.map((s) => tx.query(s)),
                tx.query(
                  "INSERT INTO coderank_migrations(name,checksum) VALUES($1,$2)",
                  [m.name, m.checksum],
                ),
              ],
              {
                fetchOptions: {
                  signal: AbortSignal.any([
                    controller.signal,
                    AbortSignal.timeout(40000),
                  ]),
                },
              },
            )
            .catch((error) => {
              console.log(
                "Migration failure:",
                m.name,
                error.code || error.name,
                error.message,
              );
              throw error;
            }),
      },
      new URL("../../database/migrations/", import.meta.url),
    );
    await query(
      "INSERT INTO users(name,email,password,role) VALUES('Admin','a@test','x','admin'),('Faculty','f@test','x','faculty'),('Student','s@test','x','student');",
    );
    await query(
      "INSERT INTO courses(course_code,name,semester) VALUES('CS','CS',1)",
    );
    await query("SELECT coderank_replace_mapping(1,1,ARRAY[2],2)");
    const body = {
      course_id: 1,
      title: "Test",
      description: "Test",
      test_cases: [{ input: "", expected: "ok", marks: 10 }],
    };
    await query("SELECT coderank_mutate_practical(2,NULL,'create',$1::jsonb)", [
      JSON.stringify(body),
    ]);
    const [{ id: caseId }] = await query("SELECT id FROM practical_test_cases");
    await Promise.all(
      Array.from({ length: 10 }, (_, marks) =>
        query(
          "SELECT coderank_save_attempt($1,3,1,'source','python','Wrong Answer',$2,$2,1,false,now(),$3::jsonb,'{}'::jsonb)",
          [
            `job-${marks}`,
            marks,
            JSON.stringify([
              {
                test_case_id: caseId,
                passed: false,
                marks_awarded: marks,
                execution_time_ms: 1,
              },
            ]),
          ],
        ),
      ),
    );
    assert.equal(
      (await query("SELECT count(*)::int n FROM practical_submissions"))[0].n,
      1,
    );
    assert.equal(
      Number(
        (await query("SELECT normalized_marks FROM practical_submissions"))[0]
          .normalized_marks,
      ),
      9,
    );
    assert.equal(
      Number(
        (await query("SELECT marks_awarded FROM practical_submission_cases"))[0]
          .marks_awarded,
      ),
      9,
    );
    const before = (await query("SELECT count(*)::int n FROM activity_logs"))[0]
      .n;
    await assert.rejects(
      query("SELECT coderank_mutate_practical(2,1,'update',$1::jsonb)", [
        JSON.stringify({
          ...body,
          title: "must rollback",
          test_cases: [{ input: "", expected: "changed", marks: 10 }],
        }),
      ]),
    );
    assert.equal(
      (await query("SELECT title FROM practicals"))[0].title,
      "Test",
    );
    assert.equal(
      (await query("SELECT count(*)::int n FROM activity_logs"))[0].n,
      before,
    );
    await query("SELECT coderank_manage_user(1,NULL,'create',$1::jsonb)", [
      JSON.stringify({
        name: "Other Faculty",
        email: "other@test",
        password_hash: "test-hash",
        role: "faculty",
      }),
    ]);
    await query("SELECT coderank_replace_mapping(1,1,ARRAY[2,4],2)");
    await Promise.allSettled([
      query("SELECT coderank_manage_user(1,2,'deactivate','{}'::jsonb)"),
      query("SELECT coderank_replace_mapping(1,1,ARRAY[2,4],2)"),
    ]);
    assert.equal(
      (await query("SELECT assigned_faculty FROM courses"))[0].assigned_faculty,
      4,
    );
    assert.deepEqual(
      (await query("SELECT faculty_id FROM course_faculty")).map(
        (r) => r.faculty_id,
      ),
      [4],
    );
    await assert.rejects(query("SELECT coderank_reset_submission(2,1)"));
    await query("SELECT coderank_reset_submission(4,1)");
    assert.equal(
      (await query("SELECT count(*)::int n FROM practical_submissions"))[0].n,
      0,
    );
    await query(
      "SELECT coderank_manage_catalog(1,'department',NULL,'create',$1::jsonb)",
      [
        JSON.stringify({
          name: "Test Department",
          institute_name: "Test Institute",
        }),
      ],
    );
    await assert.rejects(
      query(
        "SELECT coderank_manage_catalog(1,'course',1,'delete','{}'::jsonb)",
      ),
    );
    assert.deepEqual(
      await migrate(
        {
          query,
          apply: () => {
            throw Error("must not reapply");
          },
        },
        new URL("../../database/migrations/", import.meta.url),
      ),
      [],
    );
    console.log(
      "Isolated schema assertions passed; application tables were not modified.",
    );
  } finally {
    clearTimeout(timer);
    if (created)
      await neon(url).query(`DROP SCHEMA ${schema} CASCADE`, [], {
        fetchOptions: { signal: AbortSignal.timeout(10000) },
      });
  }
});
