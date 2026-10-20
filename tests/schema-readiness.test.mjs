import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import required from "../packages/database/src/required-migrations.json" with { type: "json" };
import { checkDatabaseReadiness } from "../packages/database/src/readiness.js";
import {
  loadMigrations,
  LEDGER_SQL,
} from "../packages/database/src/migrations.js";

test("bundled readiness manifest matches every versioned migration checksum", async () => {
  const migrations = await loadMigrations(
    new URL("../database/migrations/", import.meta.url),
  );
  assert.deepEqual(
    required,
    migrations.map(({ name, checksum }) => ({ name, checksum })),
  );
});

test("readiness fails closed for absent, pending and modified schemas without writing to the database", async () => {
  const db = new PGlite();
  const query = async (q, p) => (await db.query(q, p)).rows;
  try {
    assert.deepEqual(await checkDatabaseReadiness(query), {
      healthy: false,
      schema: "missing",
    });
    assert.equal(
      (await query("SELECT to_regclass('coderank_migrations') AS ledger"))[0]
        .ledger,
      null,
    );
    await db.exec(LEDGER_SQL);
    for (const migration of required.slice(0, -1))
      await query(
        "INSERT INTO coderank_migrations(name,checksum) VALUES($1,$2)",
        [migration.name, migration.checksum],
      );
    assert.deepEqual(await checkDatabaseReadiness(query), {
      healthy: false,
      schema: "pending",
    });
    const last = required.at(-1);
    await query(
      "INSERT INTO coderank_migrations(name,checksum) VALUES($1,$2)",
      [last.name, last.checksum],
    );
    assert.deepEqual(await checkDatabaseReadiness(query), {
      healthy: true,
      schema: "current",
    });
    await query("UPDATE coderank_migrations SET checksum=$1 WHERE name=$2", [
      "changed",
      last.name,
    ]);
    assert.deepEqual(await checkDatabaseReadiness(query), {
      healthy: false,
      schema: "mismatch",
    });
    assert.equal(
      (
        await query("SELECT checksum FROM coderank_migrations WHERE name=$1", [
          last.name,
        ])
      )[0].checksum,
      "changed",
      "Health check must not repair the ledger",
    );
    await assert.rejects(
      checkDatabaseReadiness(async () => {
        throw Error("private connection details");
      }),
      (error) => error.message === "Database readiness query failed",
    );
  } finally {
    await db.close();
  }
});
