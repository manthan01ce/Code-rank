import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import required from "../packages/database/src/required-migrations.json" with { type: "json" };
process.env.JWT_SECRET = "health-api-test-secret";
registerHooks({
  resolve(specifier, context, next) {
    return next(
      specifier === "next/server" ? "next/server.js" : specifier,
      context,
    );
  },
});
let dbHealthy = true,
  queueHealthy = true,
  workerHealthy = true,
  schemaCurrent = true,
  now = Date.now();
mock.method(Date, "now", () => now);
const db = async () => [{ active: 1 }];
db.query = async () => {
  if (!dbHealthy) throw Error("offline");
  return schemaCurrent ? required : required.slice(0, -1);
};
mock.module(
  new URL("../packages/core/src/db/client.js", import.meta.url).href,
  { defaultExport: db },
);
mock.module("@coderank/core/services/SubmissionService", {
  namedExports: {
    SubmissionService: {
      getQueueStats: async () => ({ cached: !queueHealthy }),
      getWorkerStatus: async () => ({
        healthy: workerHealthy,
        healthyWorkers: workerHealthy ? 1 : 0,
      }),
    },
  },
});
const { getUserFromRequest } = await import(
  "../packages/core/src/utils/auth.js"
);
mock.module("@coderank/core/security/active-actor", {
  namedExports: {
    authenticateRequest: async (request, { optional = false } = {}) => {
      const header = request?.headers?.get?.("authorization");
      if (optional && !header) return null;
      const actor = header && getUserFromRequest(request);
      if (!actor) throw { status: 401, message: "Authentication required" };
      return actor;
    },
  },
});
const { GET } = await import("../apps/web/src/app/api/health/route.js");
test("readiness becomes 503 after dependency failure and does not retain stale healthy state", async () => {
  assert.equal((await GET()).status, 200);
  schemaCurrent = false;
  now += 11000;
  const pending = await GET();
  assert.equal(pending.status, 503);
  assert.equal((await pending.json()).services.database.schema, "pending");
  schemaCurrent = true;
  dbHealthy = false;
  now += 11000;
  const failed = await GET();
  assert.equal(failed.status, 503);
  assert.equal((await failed.json()).services.database.status, "degraded");
  dbHealthy = true;
  queueHealthy = false;
  now += 11000;
  assert.equal((await GET()).status, 503);
  queueHealthy = true;
  workerHealthy = false;
  now += 11000;
  const missingWorker = await GET();
  assert.equal(missingWorker.status, 503);
  assert.equal(
    (await missingWorker.json()).services.execution.status,
    "degraded",
  );
  workerHealthy = true;
  now += 11000;
  assert.equal((await GET()).status, 200);
});
