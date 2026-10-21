import required from "./required-migrations.json" with { type: "json" };

// Bundle-safe manifest: health checks never create a ledger or run migrations.
export async function checkDatabaseReadiness(query) {
  let rows;
  try {
    rows = await query("SELECT name,checksum FROM coderank_migrations", []);
  } catch (error) {
    if (error.code === "42P01") return { healthy: false, schema: "missing" };
    throw new Error("Database readiness query failed");
  }
  const applied = new Map(rows.map((row) => [row.name, row.checksum]));
  if (required.some((migration) => !applied.has(migration.name)))
    return { healthy: false, schema: "pending" };
  if (
    required.some(
      (migration) => applied.get(migration.name) !== migration.checksum,
    )
  )
    return { healthy: false, schema: "mismatch" };
  return { healthy: true, schema: "current" };
}
