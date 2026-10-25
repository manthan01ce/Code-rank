import "../packages/core/src/config/env.js";
import assert from "node:assert/strict";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  mkdirSync,
  openSync,
  closeSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import pg from "pg";
import { hashPassword } from "../packages/core/src/utils/auth.js";
import { createPostgresClient } from "../packages/database/src/postgres.js";
import {
  migrate,
  loadMigrations,
} from "../packages/database/src/migrations.js";
import { checkDeployment } from "./lib/deployment-readiness.mjs";

import { capacityOptions, runCapacity } from "../load-tests/capacity.mjs";
import {
  databaseIdentity,
  runDatabaseOperations,
} from "./lib/database-ops.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const url = new URL(process.env.TEST_DATABASE_URL || "invalid:");
assert.ok(
  ["postgres:", "postgresql:"].includes(url.protocol) &&
    ["127.0.0.1", "localhost"].includes(url.hostname) &&
    url.pathname.endsWith("_test"),
  "TEST_DATABASE_URL must name a loopback disposable *_test database",
);
const database = `coderank_e2e_${randomBytes(8).toString("hex")}`;
const appUrl = new URL(url);
appUrl.pathname = "/" + database;
const port = "3101",
  base = `http://127.0.0.1:${port}`;
const password = randomBytes(16).toString("hex");
const env = {
  ...process.env,
  NODE_ENV: "production",
  HOSTNAME: "127.0.0.1",
  PORT: port,
  DATABASE_DRIVER: "postgres",
  DATABASE_URL: appUrl.href,
  DB_POOL_SIZE: "3",
  DB_QUERY_TIMEOUT_MS: "5000",
  JWT_SECRET: randomBytes(48).toString("hex"),
  REALTIME_URL: base,
  ALLOWED_ORIGIN: base,
  REALTIME_REDIS_ENABLED: "true",
  CLUSTER_ENABLED: "true",
  WEB_CONCURRENCY: "2",
  DISABLE_RATE_LIMIT: "false",
  MAX_CONCURRENT_JOBS: "2",
  BROWSER_BASE_URL: base,
  E2E_ADMIN_EMAIL: "admin@e2e.test",
  E2E_ADMIN_PASSWORD: password,
  E2E_FACULTY_EMAIL: "faculty@e2e.test",
  E2E_FACULTY_PASSWORD: password,
  E2E_STUDENT_EMAIL: "student@e2e.test",
  E2E_STUDENT_PASSWORD: password,
  E2E_PRACTICAL_ID: "1",
};
const children = [],
  descriptors = [];
const admin = new pg.Pool({
  connectionString: url.href,
  max: 1,
  connectionTimeoutMillis: 5000,
  statement_timeout: 5000,
});
admin.on("error", () => {});
let sql,
  created = false;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function start(name, script) {
  const fd = openSync(`${root}/test-results/authenticated/${name}.log`, "w");
  descriptors.push(fd);
  const child = spawn(process.execPath, [script], {
    cwd: root,
    env,
    detached: process.platform !== "win32",
    stdio: ["ignore", fd, fd],
  });
  child.on("error", (error) => {
    child.startupError = error;
  });
  children.push(child);
  return child;
}
async function request(path, { token, body, method = "GET" } = {}) {
  return fetch(base + path, {
    method,
    redirect: "error",
    signal: AbortSignal.timeout(10000),
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function login(email, loginPassword = password) {
  const response = await request("/api/auth/login", {
    method: "POST",
    body: { email, password: loginPassword },
  });
  assert.equal(response.status, 200, `Login ${email}`);
  return (await response.json()).token;
}
async function ready() {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    for (const child of children)
      if (
        child.startupError ||
        child.exitCode !== null ||
        child.signalCode !== null
      )
        throw Error("Cluster/worker exited; inspect authenticated logs");
    try {
      await checkDeployment(base);
      const log = readFileSync(
        `${root}/test-results/authenticated/web.log`,
        "utf8",
      );
      if (
        new Set(
          [...log.matchAll(/Cluster worker listening pid=(\d+)/g)].map(
            (match) => match[1],
          ),
        ).size >= 2
      )
        return;
    } catch {}
    await pause(500);
  }
  throw Error("Database-backed cluster readiness deadline exceeded");
}
async function waitJob(id, token) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    const response = await request(`/api/jobs/${id}`, { token });
    assert.equal(response.status, 200);
    const job = await response.json();
    if (job.status === "failed") throw Error("Authenticated submission failed");
    if (job.status === "completed") return job;
    await pause(150);
  }
  throw Error("Authenticated submission completion timed out");
}
async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit");
  if (process.platform === "win32") {
    child.kill("SIGTERM");
  } else {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  }
  let timer;
  try {
    await Promise.race([
      exited,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          try {
            if (process.platform === "win32") child.kill("SIGKILL");
            else process.kill(-child.pid, "SIGKILL");
          } catch {}
          reject(Error("Stack shutdown deadline exceeded"));
        }, 15000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

try {
  execFileSync("docker", ["info"], { stdio: "ignore", timeout: 10000 });
  mkdirSync(`${root}/test-results/authenticated`, { recursive: true });
  await admin.query(`CREATE DATABASE ${database}`);
  created = true;
  const initialMigration = await runDatabaseOperations({
    databaseUrl: appUrl.href,
    restoreAdminUrl: url.href,
    target: databaseIdentity(appUrl.href),
    output: `${root}/test-results/authenticated/database-migration`,
    mode: "migrate",
    maintenanceConfirmed: true,
  });
  assert.equal(
    initialMigration.appliedMigrations.length,
    (await loadMigrations(new URL("../database/migrations/", import.meta.url)))
      .length,
    "Fresh database must receive every migration after verified backup/rehearsal",
  );
  sql = createPostgresClient(appUrl.href, { poolSize: 2, timeoutMs: 10000 });
  const adapter = {
    query: sql.query,
    apply: (m) =>
      sql.transaction((tx) => [
        tx.query("SELECT pg_advisory_xact_lock(20401017,1)"),
        ...m.statements.map((text) => tx.query(text)),
        tx.query(
          "INSERT INTO coderank_migrations(name,checksum) VALUES($1,$2)",
          [m.name, m.checksum],
        ),
      ]),
  };
  await migrate(adapter, new URL("../database/migrations/", import.meta.url));
  assert.deepEqual(
    await migrate(adapter, new URL("../database/migrations/", import.meta.url)),
    [],
  );
  const hashed = await hashPassword(password);
  for (const [name, email, role] of [
    ["CI Admin", env.E2E_ADMIN_EMAIL, "admin"],
    ["CI Faculty", env.E2E_FACULTY_EMAIL, "faculty"],
    ["CI Student", env.E2E_STUDENT_EMAIL, "student"],
    ["CI Other", "other@e2e.test", "student"],
  ]) {
    await sql.query(
      "INSERT INTO users(name,email,password,role,extra_info) VALUES($1,$2,$3,$4,$5::jsonb)",
      [
        name,
        email,
        hashed,
        role,
        JSON.stringify({
          semester: 1,
          batch: "A",
          department: "CI Department",
          division: "A",
        }),
      ],
    );
  }
  await sql.query(
    "INSERT INTO departments(name,institute_name) VALUES('CI Department','CI Institute')",
  );
  await sql.query(
    "INSERT INTO courses(course_code,name,semester,assigned_faculty) VALUES('CI101','CI Course',1,2)",
  );
  await sql.query("SELECT coderank_replace_mapping(1,1,ARRAY[2],2)");
  await sql.query(
    "INSERT INTO practicals(faculty_id,course_id,batch_id,title,description,total_marks,status,start_time,end_time) VALUES(2,1,'A','CI Practical','Browser assignment',10,'active',now()-interval '1 hour',now()+interval '1 hour')",
  );
  await sql.query(
    "INSERT INTO practical_test_cases(practical_id,input,expected,marks,is_hidden,order_index,time_limit) VALUES(1,'','ok',10,true,0,5)",
  );
  const cases = JSON.stringify([
    {
      test_case_id: 1,
      passed: true,
      marks_awarded: 10,
      execution_time_ms: 1,
      actual_output: "ok",
    },
  ]);
  for (const student of [3, 4])
    await sql.query(
      "SELECT coderank_save_attempt($1,$2,1,'seed','python','Accepted',10,10,1,false,now(),$3::jsonb,$4::jsonb)",
      [
        `seed-${student}`,
        student,
        cases,
        JSON.stringify({ status: "accepted" }),
      ],
    );
  start("web", "apps/web/cluster.js");
  const executionWorker = start("worker", "apps/worker/src/index.js");
  await ready();
  const clusterLog = readFileSync(
    `${root}/test-results/authenticated/web.log`,
    "utf8",
  );
  assert.ok(
    new Set(
      [...clusterLog.matchAll(/Cluster worker listening pid=(\d+)/g)].map(
        (match) => match[1],
      ),
    ).size >= 2,
    "Both cluster workers must listen",
  );
  let token = await login(env.E2E_STUDENT_EMAIL);
  const response = await request("/api/student/practicals/1/submit", {
    method: "POST",
    token,
    body: { language: "python", code: "print('ok')" },
  });
  assert.equal(response.status, 202);
  const { jobId } = await response.json(),
    job = await waitJob(jobId, token);
  assert.equal(job.result.status, "accepted");
  assert.equal(
    (
      await sql.query(
        "SELECT count(*)::int n FROM submission_attempts WHERE job_id=$1",
        [jobId],
      )
    )[0].n,
    1,
  );
  assert.equal(
    (
      await sql.query(
        "SELECT count(*)::int n FROM practical_submissions WHERE student_id=3 AND practical_id=1",
      )
    )[0].n,
    1,
  );
  for (const item of job.result.cases)
    for (const key of ["input", "expected", "actual_output", "expected_output"])
      assert.equal(item[key], undefined);
  const newPassword = randomBytes(16).toString("hex");
  const changed = await request("/api/auth/change-password", {
    method: "POST",
    token,
    body: { currentPassword: password, newPassword },
  });
  assert.equal(changed.status, 200);
  const replacement = (await changed.json()).token;
  assert.ok(replacement);
  assert.equal((await request("/api/auth/profile", { token })).status, 401);
  token = replacement;
  assert.equal((await request("/api/auth/profile", { token })).status, 200);
  env.E2E_STUDENT_PASSWORD = newPassword;
  const browser = spawnSync(
    process.execPath,
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "--config=tests/browser/playwright.config.mjs",
    ],
    { cwd: root, env, stdio: "inherit", timeout: 300000 },
  );
  assert.equal(browser.status, 0, "All real browser role workflows must pass");
  const browserReport = JSON.parse(
    readFileSync(`${root}/test-results/browser-results.json`, "utf8"),
  );
  assert.ok(browserReport.stats.expected > 0);
  for (const key of ["unexpected", "flaky", "skipped"])
    assert.equal(browserReport.stats[key], 0, `Browser ${key} must be zero`);
  assert.equal(
    (
      await sql.query(
        "SELECT count(*)::int n FROM courses WHERE course_code='BROWSER_DENIED'",
      )
    )[0].n,
    0,
  );
  assert.equal(
    (
      await sql.query(
        "SELECT count(*)::int n FROM departments WHERE name='BROWSER_DENIED'",
      )
    )[0].n,
    0,
  );
  // Browser logins rotate the student's session. Use a freshly authenticated
  // session for recovery instead of the now-revoked pre-browser JWT.
  token = await login(env.E2E_STUDENT_EMAIL, newPassword);

  // Crash one web process and require the cluster to replace it while the
  // same rotated session remains valid through the surviving process.
  const recovery = {};
  const beforeWeb = Date.now();
  const oldPids = new Set(
    [
      ...readFileSync(
        `${root}/test-results/authenticated/web.log`,
        "utf8",
      ).matchAll(/Cluster worker listening pid=(\d+)/g),
    ].map((match) => Number(match[1])),
  );
  process.kill([...oldPids][0], "SIGKILL");
  const webDeadline = Date.now() + 30000;
  let replaced = false;
  while (Date.now() < webDeadline) {
    const pids = [
      ...readFileSync(
        `${root}/test-results/authenticated/web.log`,
        "utf8",
      ).matchAll(/Cluster worker listening pid=(\d+)/g),
    ].map((match) => Number(match[1]));
    if (pids.some((pid) => !oldPids.has(pid))) {
      replaced = true;
      break;
    }
    await pause(100);
  }
  assert.ok(replaced, "Cluster must replace a crashed web worker");
  assert.equal((await request("/api/auth/profile", { token })).status, 200);
  recovery.webReplacementMs = Date.now() - beforeWeb;

  // Stop the execution process, enqueue a real grade while it is offline,
  // then prove the same durable job is consumed after restarting it.
  const workerExited = once(executionWorker, "exit", {
    signal: AbortSignal.timeout(10000),
  });
  process.kill(-executionWorker.pid, "SIGKILL");
  await workerExited;
  children.splice(children.indexOf(executionWorker), 1);
  const pending = await request("/api/student/practicals/1/submit", {
    method: "POST",
    token,
    body: { language: "python", code: "print('ok')" },
  });
  assert.equal(pending.status, 202);
  const pendingId = (await pending.json()).jobId;
  const waiting = await request(`/api/jobs/${pendingId}`, { token });
  assert.equal(waiting.status, 200);
  assert.equal((await waiting.json()).status, "waiting");
  const beforeWorker = Date.now();
  start("worker-restarted", "apps/worker/src/index.js");
  const recovered = await waitJob(pendingId, token);
  assert.equal(recovered.result.status, "accepted");
  assert.equal(
    (
      await sql.query(
        "SELECT count(*)::int n FROM submission_attempts WHERE job_id=$1",
        [pendingId],
      )
    )[0].n,
    1,
  );
  assert.equal(
    (
      await sql.query(
        "SELECT count(*)::int n FROM practical_submissions WHERE student_id=3 AND practical_id=1",
      )
    )[0].n,
    1,
  );
  recovery.executionRecoveryMs = Date.now() - beforeWorker;
  await checkDeployment(base);
  writeFileSync(
    `${root}/test-results/authenticated/process-recovery.json`,
    JSON.stringify(recovery, null, 2),
  );

  const capacity = await runCapacity(
    capacityOptions({
      BASE_URL: base,
      JWT_TOKEN: token,
      CAPACITY_JOBS: "12",
      CAPACITY_CONCURRENCY: "2",
      CAPACITY_P95_MS: "15000",
      CAPACITY_MIN_RPS: "0.1",
      CAPACITY_DURATION_MS: "60000",
    }),
  );
  writeFileSync(
    `${root}/test-results/authenticated/capacity.json`,
    JSON.stringify(capacity, null, 2),
  );
  assert.equal(
    capacity.passed,
    true,
    "Measured execution capacity gate must pass all thresholds",
  );
  console.log(
    `Capacity passed: ${capacity.completed} jobs, ${capacity.achievedRps.toFixed(2)} jobs/s, p95 ${capacity.latencyMs.p95.toFixed(0)} ms`,
  );

  const databaseRecovery = await runDatabaseOperations({
    databaseUrl: appUrl.href,
    restoreAdminUrl: url.href,
    target: databaseIdentity(appUrl.href),
    output: `${root}/test-results/authenticated/database-recovery`,
    mode: "migrate",
    maintenanceConfirmed: true,
  });
  assert.ok(databaseRecovery);
  console.log(
    "Recovery passed: web replacement, queued grading after execution-worker crash, and verified database backup/restore rehearsal.",
  );
  console.log(
    "Authenticated cluster passed: real migrations, grading persistence, session rotation and browser role/privacy workflows.",
  );
} finally {
  const stopped = await Promise.allSettled(children.map(stop));
  for (const fd of descriptors) closeSync(fd);
  if (sql) await sql.close();
  if (created) await admin.query(`DROP DATABASE ${database} WITH (FORCE)`);
  await admin.end();
  if (stopped.some((result) => result.status === "rejected"))
    throw Error("Stack did not shut down cleanly");
}
