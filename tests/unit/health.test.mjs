import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import required from "../../packages/database/src/required-migrations.json" with { type: "json" };
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
  new URL("../../packages/core/src/db/client.js", import.meta.url).href,
  { defaultExport: db },
);
mock.module("@coderank/database", {
  defaultExport: db,
  namedExports: { closeDatabase: async () => {} },
});
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
  "../../packages/core/src/utils/auth.js"
);
mock.module("@coderank/core/security/active-actor", {
  namedExports: {
    authenticateToken: async () => ({ id: 1, role: "admin" }),
    authenticateRequest: async (request, { optional = false } = {}) => {
      const header = request?.headers?.get?.("authorization");
      if (optional && !header) return null;
      const actor = header && getUserFromRequest(request);
      if (!actor) throw { status: 401, message: "Authentication required" };
      return actor;
    },
  },
});
const { buildApp } = await import("../../apps/api/src/app.js");
test("readiness becomes 503 after dependency failure and does not retain stale healthy state", async () => {
  const app = buildApp();
  await app.ready();
  try {
    const res1 = await app.inject({ method: "GET", url: "/api/health" });
    assert.equal(res1.statusCode, 200);

    schemaCurrent = false;
    now += 11000;
    const pending = await app.inject({ method: "GET", url: "/api/health" });
    assert.equal(pending.statusCode, 503);
    assert.equal(pending.json().services.database.schema, "pending");

    schemaCurrent = true;
    dbHealthy = false;
    now += 11000;
    const failed = await app.inject({ method: "GET", url: "/api/health" });
    assert.equal(failed.statusCode, 503);
    assert.equal(failed.json().services.database.status, "degraded");

    dbHealthy = true;
    queueHealthy = false;
    now += 11000;
    const degradedQueue = await app.inject({ method: "GET", url: "/api/health" });
    assert.equal(degradedQueue.statusCode, 503);

    queueHealthy = true;
    workerHealthy = false;
    now += 11000;
    const missingWorker = await app.inject({ method: "GET", url: "/api/health" });
    assert.equal(missingWorker.statusCode, 503);
    assert.equal(
      missingWorker.json().services.execution.status,
      "degraded",
    );

    workerHealthy = true;
    now += 11000;
    const restored = await app.inject({ method: "GET", url: "/api/health" });
    assert.equal(restored.statusCode, 200);
  } finally {
    await app.close();
  }
});
