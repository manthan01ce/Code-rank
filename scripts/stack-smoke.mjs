// Run only against child processes and disposable CI Redis. No application DB is used.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, openSync, closeSync } from "node:fs";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { io } from "socket.io-client";
import { browserSocketAuth } from "../apps/web/src/lib/browser-socket-auth.js";
import { successfulExecution } from "../load-tests/lib/execution-result.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const port = process.env.STACK_TEST_PORT || "3100";
assert.match(port, /^\d+$/);
const base = `http://127.0.0.1:${port}`;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const children = [],
  sockets = [],
  descriptors = [];
const env = {
  ...process.env,
  NODE_ENV: "production",
  HOSTNAME: "127.0.0.1",
  PORT: port,
  REALTIME_URL: base,
  ALLOWED_ORIGIN: base,
  CLUSTER_ENABLED: "false",
  JWT_SECRET: randomBytes(48).toString("hex"),
  // Force the disposable test away from any configured Neon database.
  DATABASE_URL: "postgresql://placeholder:placeholder@127.0.0.1/placeholder",
  DB_QUERY_TIMEOUT_MS: "4000",
  MAX_CONCURRENT_JOBS: "2",
  REALTIME_REDIS_ENABLED: "true",
  DISABLE_RATE_LIMIT: "false",
};

function start(name, args) {
  const fd = openSync(`${root}/test-results/stack/${name}.log`, "w");
  descriptors.push(fd);
  const child = spawn(process.execPath, args, {
    cwd: root,
    env,
    stdio: ["ignore", fd, fd],
  });
  child.on("error", (error) => {
    child.startupError = error;
  });
  children.push(child);
}
async function request(path, options = {}) {
  return fetch(base + path, {
    ...options,
    redirect: "error",
    signal: AbortSignal.timeout(6000),
  });
}
async function waitReady() {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    for (const child of children) {
      if (child.startupError || child.exitCode !== null)
        throw Error("Stack process exited; inspect test-results/stack logs");
    }
    let health, report;
    try {
      const response = await request("/api/live");
      if (response.status === 200) {
        health = await request("/api/health");
        report = await health.json();
      }
    } catch {
      // Only transport/startup failures are retried; assertions below fail fast.
    }
    if (report?.services?.execution?.status === "healthy") {
      assert.equal(
        health.status,
        503,
        "placeholder DB must not establish database readiness",
      );
      assert.equal(report.services.database.status, "degraded");
      assert.equal(report.services.queue.status, "healthy");
      return;
    }
    await pause(500);
  }
  throw Error(
    "Stack readiness deadline exceeded; inspect test-results/stack logs",
  );
}
async function submit(language, code, cookie) {
  const response = await request("/api/execute", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify({ language, code, input: "" }),
  });
  assert.equal(response.status, 202);
  assert.match(response.headers.get("cache-control"), /no-store/);
  const setCookie = response.headers.get("set-cookie");
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  return { ...(await response.json()), cookie: setCookie.split(";")[0] };
}
async function poll(jobId, cookie) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    const response = await request(`/api/jobs/${jobId}`, {
      headers: { Cookie: cookie },
    });
    assert.equal(response.status, 200);
    const job = await response.json();
    if (["completed", "failed"].includes(job.status)) return job;
    await pause(150);
  }
  throw Error("Execution completion deadline exceeded");
}
async function connect(cookie) {
  const socket = io(base, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
    auth: browserSocketAuth({ getItem: () => null }),
    extraHeaders: { Cookie: cookie },
  });
  sockets.push(socket);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error("Socket connection timed out")),
      10000,
    );
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
  return socket;
}

try {
  execFileSync("docker", ["info"], { stdio: "ignore", timeout: 10000 });
  execFileSync(
    "docker",
    ["image", "inspect", process.env.RUNNER_IMAGE || "coderank-base:latest"],
    { stdio: "ignore", timeout: 10000 },
  );
  mkdirSync(`${root}/test-results/stack`, { recursive: true });
  start("web", ["apps/web/server.js"]);
  start("worker", ["apps/worker/src/index.js"]);
  await waitReady();

  const first = await submit(
    "python",
    "import time\ntime.sleep(2)\nprint('stack-python')",
  );
  const owner = await connect(first.cookie);
  const otherCookie = `coderank_execution_session=${randomBytes(32).toString("hex")}`;
  const other = await connect(otherCookie);
  const leaked = [];
  other.on("job_complete", (value) => leaked.push(value));
  assert.equal(
    (await other.timeout(5000).emitWithAck("watch_job", first.jobId)).ok,
    false,
  );
  assert.equal(
    (
      await owner.timeout(5000).emitWithAck("worker_job_complete", {
        jobId: first.jobId,
        result: { stdout: "forged" },
      })
    ).ok,
    false,
  );
  const event = new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error("Worker realtime event timed out")),
      15000,
    );
    owner.once("job_complete", (value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
  // Attach a handler immediately so assertion failure cannot cause an unhandled rejection.
  event.catch(() => {});
  assert.equal(
    (await owner.timeout(5000).emitWithAck("watch_job", first.jobId)).ok,
    true,
  );
  const result = await poll(first.jobId, first.cookie);
  assert.ok(successfulExecution(result, "stack-python"));
  const notification = await event;
  assert.equal(notification.jobId, first.jobId);
  assert.equal(notification.stdout, "stack-python");
  await pause(200);
  assert.deepEqual(
    leaked,
    [],
    "another guest must not receive the owner completion",
  );
  assert.equal((await request(`/api/jobs/${first.jobId}`)).status, 403);
  assert.equal(
    (
      await request(`/api/jobs/${first.jobId}`, {
        headers: { Cookie: otherCookie },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(`/api/jobs/${first.jobId}`, {
        headers: { Cookie: first.cookie, Authorization: "Bearer invalid" },
      })
    ).status,
    401,
  );

  const programs = {
    c: '#include <stdio.h>\nint main(){puts("stack-c");return 0;}',
    cpp: '#include <iostream>\nint main(){std::cout << "stack-cpp" << std::endl;}',
    java: 'public class Solution {public static void main(String[] args){System.out.println("stack-java");}}',
    javascript: 'console.log("stack-javascript")',
  };
  for (const [language, code] of Object.entries(programs)) {
    const job = await submit(language, code, first.cookie);
    assert.ok(
      successfulExecution(
        await poll(job.jobId, job.cookie),
        `stack-${language}`,
      ),
      language,
    );
  }
  const failed = await submit(
    "python",
    "print('output-before-failure')\nraise RuntimeError('expected failure')",
    first.cookie,
  );
  const failure = await poll(failed.jobId, failed.cookie);
  assert.equal(failure.status, "completed");
  assert.equal(failure.result.success, false);
  assert.notEqual(failure.result.exitCode, 0);
  console.log(
    "Full stack passed: five languages, real worker delivery, guest ownership, invalid bearer denial and runtime failure.",
  );
} finally {
  for (const socket of sockets) socket.disconnect();
  await Promise.all(
    children.map(async (child) => {
      if (child.exitCode !== null) return;
      const exited = once(child, "exit");
      child.kill("SIGTERM");
      let timer;
      try {
        await Promise.race([
          exited,
          new Promise((resolve) => {
            timer = setTimeout(() => {
              child.kill("SIGKILL");
              resolve();
            }, 15000);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    }),
  );
  for (const fd of descriptors) closeSync(fd);
}
