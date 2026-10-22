import test, { mock } from "node:test";
import assert from "node:assert/strict";
process.env.DATABASE_DRIVER = "postgres";
process.env.DATABASE_URL = "postgresql://test";
process.env.DB_QUERY_TIMEOUT_MS = "10";
const delayed = () =>
  new Promise((resolve) => setTimeout(() => resolve(["committed"]), 30));
mock.module(
  new URL("../packages/database/src/postgres.js", import.meta.url).href,
  {
    namedExports: {
      createPostgresClient: () =>
        Object.assign(() => delayed(), {
          query: delayed,
          transaction: delayed,
          close: async () => {},
        }),
    },
  },
);
const { default: sql, closeDatabase } = await import(
  "../packages/database/src/client.js"
);

test("native transaction awaits its definitive result instead of timing out before a late commit", async () => {
  assert.deepEqual(await sql.transaction(() => []), ["committed"]);
  await assert.rejects(sql.query("SELECT 1"), /timed out/);
  await closeDatabase();
});
