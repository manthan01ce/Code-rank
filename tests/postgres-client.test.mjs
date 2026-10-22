import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { createPostgresClient } from "../packages/database/src/postgres.js";

test("PostgreSQL transport parameterizes tags and rolls back failed transactions", async () => {
  const db = new PGlite();
  let released = 0,
    options,
    ended = 0;
  class Pool {
    constructor(config) {
      options = config;
    }
    on() {}
    query(text, values) {
      return db.query(text, values);
    }
    async connect() {
      return {
        query: (text, values) => db.query(text, values),
        release: () => {
          released++;
        },
      };
    }
    async end() {
      ended++;
      await db.close();
    }
  }
  const sql = createPostgresClient("postgresql://test", {
    Pool,
    poolSize: 3,
    timeoutMs: 500,
  });
  try {
    assert.equal(options.max, 3);
    assert.equal(options.statement_timeout, 500);
    await sql.query("CREATE TABLE records (id int PRIMARY KEY, value text)");
    const payload = "x'); DROP TABLE records; --";
    await sql`INSERT INTO records(id,value) VALUES(${1},${payload})`;
    assert.equal(
      (await sql`SELECT value FROM records WHERE id=${1}`)[0].value,
      payload,
    );
    await assert.rejects(
      sql.transaction((tx) => [
        tx`INSERT INTO records VALUES(${2},${"pending"})`,
        tx`INSERT INTO records VALUES(${1},${"duplicate"})`,
      ]),
    );
    assert.equal(
      (await sql.query("SELECT count(*)::int n FROM records"))[0].n,
      1,
    );
    const results = await sql.transaction((tx) => [
      tx.query("INSERT INTO records VALUES($1,$2) RETURNING id", [
        2,
        "committed",
      ]),
      tx`SELECT count(*)::int n FROM records`,
    ]);
    assert.equal(results[1][0].n, 2);
    assert.equal(released, 2);
    assert.throws(() => sql("SELECT 1"), /sql.query/);
  } finally {
    await sql.close();
    await sql.close();
    assert.equal(ended, 1);
  }
});

test("PostgreSQL transport rejects invalid pool/timeout configuration", () => {
  for (const poolSize of [0, -1, 51, 1.5, "bad"])
    assert.throws(
      () => createPostgresClient("postgresql://test", { poolSize }),
      /DB_POOL_SIZE/,
    );
  for (const timeoutMs of [0, -1, 120001, "bad"])
    assert.throws(
      () => createPostgresClient("postgresql://test", { timeoutMs }),
      /DB_QUERY_TIMEOUT_MS/,
    );
});

test("failed rollback discards its connection and preserves the original failure", async () => {
  const original = new Error("statement failed");
  const rollbackFailure = new Error("connection lost during rollback");
  const releases = [];
  let cached, connections = 0;
  class Pool {
    on() {}
    async connect() {
      if (cached) return cached;
      const first = ++connections === 1;
      let transactionOpen = false;
      cached = {
        async query(text) {
          if (text === "BEGIN") {
            assert.equal(transactionOpen, false, "must not recycle an open transaction");
            transactionOpen = true;
          } else if (text === "FAIL") throw original;
          else if (text === "ROLLBACK" && first) throw rollbackFailure;
          else if (text === "COMMIT" || text === "ROLLBACK") transactionOpen = false;
          return { rows: [] };
        },
        release(error) {
          releases.push(error);
          if (error) cached = undefined;
        },
      };
      return cached;
    }
    async end() {}
  }
  const sql = createPostgresClient("postgresql://test", { Pool });
  try {
    await assert.rejects(sql.transaction(tx => [tx.query("FAIL")]), error => error === original);
    assert.equal(releases[0], rollbackFailure);
    await sql.transaction(tx => [tx.query("SELECT 1")]);
    assert.equal(connections, 2, "next transaction must get a clean connection");
    assert.equal(releases[1], undefined, "successful transactions remain reusable");
  } finally { await sql.close(); }
});
