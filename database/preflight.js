import "../packages/core/src/config/env.js";
import sql from "../packages/database/src/client.js";
import { loadMigrations } from "../packages/database/src/migrations.js";
const required = {
  users: ["id", "role", "status", "session_token", "extra_info"],
  courses: ["id", "semester", "assigned_faculty"],
  course_faculty: ["course_id", "faculty_id", "is_co_coordinator"],
  practicals: ["id", "course_id", "status", "updated_at"],
  practical_submissions: [
    "student_id",
    "practical_id",
    "code",
    "normalized_marks",
  ],
  practical_submission_cases: ["submission_id", "test_case_id"],
  student_workspaces: ["student_id", "practical_id", "language", "latest_code"],
};
try {
  const columns = await sql.query(
    "SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public'",
  );
  const missing = Object.entries(required).flatMap(([table, names]) =>
    names
      .filter(
        (name) =>
          !columns.some(
            (c) => c.table_name === table && c.column_name === name,
          ),
      )
      .map((column) => ({ table, column })),
  );
  const [counts] =
    await sql.query(`SELECT (SELECT count(*) FROM practical_submissions)::int submissions,
  (SELECT count(*) FROM (SELECT 1 FROM practical_submissions GROUP BY student_id,practical_id HAVING count(*)>1) d)::int duplicate_grades,
  (SELECT count(*) FROM (SELECT 1 FROM student_workspaces GROUP BY student_id,practical_id,language HAVING count(*)>1) d)::int duplicate_workspaces`);
  const [ledger] = await sql.query(
    "SELECT to_regclass('public.coderank_migrations')::text name",
  );
  const applied = ledger.name
    ? await sql.query(
        "SELECT name,checksum FROM coderank_migrations ORDER BY name",
      )
    : [];
  const migrations = await loadMigrations(
    new URL("./migrations/", import.meta.url),
  );
  const altered = applied
    .filter(
      (a) => migrations.find((m) => m.name === a.name)?.checksum !== a.checksum,
    )
    .map((a) => a.name);
  console.log(
    JSON.stringify(
      {
        readOnly: true,
        missingColumns: missing,
        counts,
        alteredMigrations: altered,
        pendingMigrations: migrations
          .filter((m) => !applied.some((a) => a.name === m.name))
          .map((m) => m.name),
      },
      null,
      2,
    ),
  );
  if (
    missing.length ||
    counts.duplicate_grades ||
    counts.duplicate_workspaces ||
    altered.length
  )
    process.exitCode = 2;
} catch (error) {
  console.error(
    JSON.stringify({
      preflight: "failed",
      code: error.code || error.cause?.code || "DATABASE_ERROR",
    }),
  );
  process.exitCode = 1;
}
