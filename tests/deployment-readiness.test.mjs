import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { checkDeployment } from "../scripts/lib/deployment-readiness.mjs";

test("deployment gate rejects degraded workers, stale health, caches and redirects over real HTTP", async () => {
  let status = 200,
    cache = "no-store";
  let health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      database: { status: "healthy" },
      queue: { status: "healthy" },
      execution: { status: "healthy", healthyWorkers: 1 },
    },
  };
  const server = createServer((req, res) => {
    res.writeHead(req.url === "/api/live" ? 200 : status, {
      "Content-Type": "application/json",
      "Cache-Control": cache,
      Location: "/login",
    });
    res.end(
      JSON.stringify(req.url === "/api/live" ? { status: "ok" } : health),
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await checkDeployment(base)).healthyWorkers, 1);
    health.services.execution.healthyWorkers = 0;
    await assert.rejects(checkDeployment(base), /No healthy execution worker/);
    health.services.execution.healthyWorkers = 1;
    health.timestamp = new Date(Date.now() - 120000).toISOString();
    await assert.rejects(checkDeployment(base), /stale/);
    health.timestamp = new Date().toISOString();
    status = 503;
    await assert.rejects(checkDeployment(base), /HTTP 503/);
    status = 200;
    cache = "public, max-age=3600";
    await assert.rejects(checkDeployment(base), /cached health/);
    cache = "no-store";
    status = 302;
    await assert.rejects(checkDeployment(base));
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
