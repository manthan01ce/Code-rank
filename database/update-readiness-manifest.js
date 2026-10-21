import { writeFile } from "node:fs/promises";
import { loadMigrations } from "../packages/database/src/migrations.js";

// Build-time metadata only. This command never connects to a database.
const migrations = await loadMigrations(
  new URL("./migrations/", import.meta.url),
);
await writeFile(
  new URL("../packages/database/src/required-migrations.json", import.meta.url),
  JSON.stringify(
    migrations.map(({ name, checksum }) => ({ name, checksum })),
    null,
    2,
  ) + "\n",
);
console.log(
  `Updated readiness manifest for ${migrations.length} migrations; no database writes.`,
);
