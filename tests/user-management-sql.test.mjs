import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { migrate } from "../packages/database/src/migrations.js";
test("user transactions preserve coordinator consistency, audit atomicity and protected accounts", async () => {
  const db = new PGlite();
  try {
    await migrate(
      {
        query: async (q, p) => (await db.query(q, p)).rows,
        apply: (m) =>
          db.transaction(async (tx) => {
            if (m.name.startsWith("003"))
              await tx.exec("ALTER TABLE practicals DROP COLUMN updated_at");
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
      "INSERT INTO users(name,email,password,role) VALUES('Admin','a@test','x','admin'),('Faculty','f@test','x','faculty'),('Other','o@test','x','faculty'); INSERT INTO courses(course_code,name,semester) VALUES('CS','CS',1); SELECT coderank_replace_mapping(1,1,ARRAY[2,3],2)",
    );
    const mutate = async (id, action, body = {}) =>
      (
        await db.query("SELECT coderank_manage_user(1,$1,$2,$3::jsonb) u", [
          id,
          action,
          JSON.stringify(body),
        ])
      ).rows[0].u;
    const inactive = await mutate(2, "deactivate");
    assert.equal(inactive.status, "inactive");
    assert.equal(inactive.password, undefined);
    assert.equal(inactive.session_token, undefined);
    assert.equal(
      (await db.query("SELECT assigned_faculty FROM courses")).rows[0]
        .assigned_faculty,
      3,
    );
    assert.equal(
      (
        await db.query(
          "SELECT faculty_id FROM course_faculty WHERE is_co_coordinator",
        )
      ).rows[0].faculty_id,
      3,
    );
    await assert.rejects(mutate(1, "deactivate"), /protected/);
    await assert.rejects(mutate(3, "update", { role: "admin" }), /role/);
    await mutate(2, "update", { status: "active" });
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int n FROM course_faculty WHERE faculty_id=2",
        )
      ).rows[0].n,
      0,
    );
    await db.exec(
      "CREATE FUNCTION reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'audit unavailable'; END$$; CREATE TRIGGER reject_audit BEFORE INSERT ON activity_logs FOR EACH ROW EXECUTE FUNCTION reject_audit()",
    );
    await assert.rejects(mutate(3, "deactivate"), /audit unavailable/);
    assert.equal(
      (await db.query("SELECT status FROM users WHERE id=3")).rows[0].status,
      "active",
    );
    assert.equal(
      (await db.query("SELECT assigned_faculty FROM courses")).rows[0]
        .assigned_faculty,
      3,
    );
    await db.exec("DROP TRIGGER reject_audit ON activity_logs");
    const created = await mutate(null, "create", {
      first_name: "New",
      last_name: "Student",
      name: "New Student",
      email: "n@test",
      password_hash: "hash",
      role: "student",
      extra_info: { division: "CE1" },
    });
    assert.equal(created.password, undefined);
    await assert.rejects(
      mutate(null, "create", {
        name: "Bad",
        email: "bad@test",
        password_hash: "hash",
        role: "admin",
      }),
    );
  } finally {
    await db.close();
  }
});
