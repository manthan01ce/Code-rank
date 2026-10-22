import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import "../../packages/core/src/config/env.js";
import { neon } from "@neondatabase/serverless";
import { migrate } from "../../packages/database/src/migrations.js";

test("Neon upgrade on copied deployed table definitions preserves compatibility", async () => {
  const url = process.env.NEON_TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!url || url.includes("placeholder"))
    throw Error("Neon configuration required");
  const client = neon(url),
    schema = "coderank_upgrade_" + randomUUID().replaceAll("-", "");
  const tx = (queries) =>
    client.transaction(queries, {
      fetchOptions: { signal: AbortSignal.timeout(40000) },
    });
  const query = async (q, p = []) =>
    (
      await tx((t) => [
        t.query(`SET LOCAL search_path TO ${schema},public`),
        t.query(q, p),
      ])
    ).at(-1);
  let created = false;
  try {
    await client.query(`CREATE SCHEMA ${schema}`, [], {
      fetchOptions: { signal: AbortSignal.timeout(20000) },
    });
    created = true;
    const tables = [
      "users",
      "departments",
      "courses",
      "course_faculty",
      "practicals",
      "practical_test_cases",
      "practical_submissions",
      "practical_submission_cases",
      "student_workspaces",
      "activity_logs",
    ];
    const cols = await client.query(
      "SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'",
    );
    await tx((t) =>
      tables.flatMap((table) => {
        const commands = [
          t.query(
            `CREATE TABLE ${schema}.${table} (LIKE public.${table} INCLUDING ALL)`,
          ),
        ];
        if (cols.some((c) => c.table_name === table && c.column_name === "id"))
          commands.push(
            t.query(`CREATE SEQUENCE ${schema}.${table}_isolated_id_seq`),
            t.query(
              `ALTER TABLE ${schema}.${table} ALTER COLUMN id SET DEFAULT nextval('${schema}.${table}_isolated_id_seq')`,
            ),
          );
        return commands;
      }),
    );
    await migrate(
      {
        query,
        apply: (m) =>
          tx((t) => [
            t.query(`SET LOCAL search_path TO ${schema},public`),
            ...m.statements.map((s) => t.query(s)),
            t.query(
              "INSERT INTO coderank_migrations(name,checksum) VALUES($1,$2)",
              [m.name, m.checksum],
            ),
          ]),
      },
      new URL("../../database/migrations/", import.meta.url),
    );
    await query(
      "INSERT INTO users(name,email,password,role) VALUES('Admin','a@test','x','admin'),('Faculty','f@test','x','faculty'),('Student','s@test','x','student')",
    );
    await query(
      "INSERT INTO courses(course_code,name,semester) VALUES('CS','CS',1)",
    );
    await query("SELECT coderank_replace_mapping(1,1,ARRAY[2],2)");
    await query("SELECT coderank_mutate_practical(2,NULL,'create',$1::jsonb)", [
      JSON.stringify({
        course_id: 1,
        title: "Upgrade test",
        description: "Test",
        test_cases: [{ input: "", expected: "ok", marks: 10 }],
      }),
    ]);
    const [{ id }] = await query("SELECT id FROM practical_test_cases");
    await query(
      "SELECT coderank_save_attempt('upgrade',3,1,'source','python','Accepted',10,10,1,false,now(),$1::jsonb,'{}'::jsonb)",
      [
        JSON.stringify([
          {
            test_case_id: id,
            passed: true,
            marks_awarded: 10,
            execution_time_ms: 1,
          },
        ]),
      ],
    );
    assert.equal(
      (await query("SELECT count(*)::int n FROM practical_submissions"))[0].n,
      1,
    );
    await query(
      "SELECT coderank_manage_catalog(1,'department',NULL,'create',$1::jsonb)",
      [
        JSON.stringify({
          name: "Upgrade Department",
          institute_name: "Test Institute",
        }),
      ],
    );
    await query("SELECT coderank_reset_submission(2,1)");
    assert.equal(
      (await query("SELECT count(*)::int n FROM practical_submissions"))[0].n,
      0,
    );
    await query("SELECT coderank_manage_user(1,2,'deactivate','{}'::jsonb)");
    assert.equal(
      (await query("SELECT assigned_faculty FROM courses"))[0].assigned_faculty,
      null,
    );
    console.log(
      "Upgrade on deployed table definitions passed; public data and sequences untouched.",
    );
  } finally {
    if (created)
      await client.query(`DROP SCHEMA ${schema} CASCADE`, [], {
        fetchOptions: { signal: AbortSignal.timeout(15000) },
      });
  }
});
