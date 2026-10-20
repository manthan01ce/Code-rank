import pg from "pg";

function integer(value, fallback, max, name) {
  const n = Number(value ?? fallback);
  if (!Number.isSafeInteger(n) || n < 1 || n > max)
    throw Error(`Invalid ${name}`);
  return n;
}
function template(strings, values) {
  if (!Array.isArray(strings?.raw) || strings.length !== values.length + 1)
    throw Error("Use sql.query for plain SQL strings");
  return {
    text: strings.reduce(
      (text, part, i) => text + (i ? `$${i}` : "") + part,
      "",
    ),
    values,
  };
}

export function createPostgresClient(
  url,
  { Pool = pg.Pool, poolSize, timeoutMs } = {},
) {
  const timeout = integer(timeoutMs, 30000, 120000, "DB_QUERY_TIMEOUT_MS");
  const pool = new Pool({
    connectionString: url,
    max: integer(poolSize, 10, 50, "DB_POOL_SIZE"),
    connectionTimeoutMillis: Math.min(timeout, 10000),
    idleTimeoutMillis: 30000,
    query_timeout: timeout,
    statement_timeout: timeout,
  });
  pool.on("error", (error) =>
    console.error("Database pool error:", error.code || "connection failure"),
  );
  const query = async (text, values = []) =>
    (await pool.query(text, values)).rows;
  const sql = (strings, ...values) => {
    const command = template(strings, values);
    return query(command.text, command.values);
  };
  sql.query = query;
  sql.transaction = async (callback) => {
    const tx = (strings, ...values) => template(strings, values);
    tx.query = (text, values = []) => ({ text, values });
    const commands = typeof callback === "function" ? callback(tx) : callback;
    if (
      !Array.isArray(commands) ||
      commands.some(
        (c) => typeof c?.text !== "string" || !Array.isArray(c.values),
      )
    )
      throw Error("Transaction callback must return SQL commands");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const results = [];
      for (const command of commands)
        results.push((await client.query(command.text, command.values)).rows);
      await client.query("COMMIT");
      return results;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* retain the original transaction failure */
      }
      throw error;
    } finally {
      client.release();
    }
  };
  let closing;
  sql.close = () => (closing ||= pool.end());
  return sql;
}
