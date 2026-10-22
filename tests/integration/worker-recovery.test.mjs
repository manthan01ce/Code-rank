import test from "node:test";
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { Queue, Worker } from "bullmq";
import {
  admissionBackend,
  sweepOwnerIndexes,
} from "../../packages/queue/src/index.js";
import { createShutdown } from "../../apps/worker/src/shutdown.js";

const connection = {
  host: "127.0.0.1",
  port: Number(process.env.REDIS_PORT || 6379),
  maxRetriesPerRequest: null,
};
async function until(read, predicate, message, timeout = 10000) {
  const deadline = Date.now() + timeout;
  do {
    const value = await read();
    if (predicate(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 25));
  } while (Date.now() < deadline);
  throw Error(message);
}
function activated(child) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => finish(Error("Child worker did not activate")),
      10000,
    );
    const message = (value) =>
      value.type === "active"
        ? finish(null, value.jobId)
        : value.type === "error" && finish(Error(value.message));
    const exit = () => finish(Error("Child worker exited before activation"));
    const onError = (value) => finish(value);
    function finish(error, value) {
      clearTimeout(timer);
      child.off("message", message);
      child.off("exit", exit);
      child.off("error", onError);
      error ? reject(error) : resolve(value);
    }
    child.on("message", message);
    child.once("exit", exit);
    child.once("error", onError);
  });
}
async function kill(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit");
  child.kill("SIGKILL");
  await exited;
}
async function sweep(queue) {
  const state = { cursor: "0", pending: [] };
  do {
    await sweepOwnerIndexes(queue, state);
  } while (state.cursor !== "0" || state.pending.length);
}

test(
  "a killed worker leaves quota reserved until the same job is recovered and completed",
  { timeout: 20000 },
  async () => {
    const name = `recovery-${randomUUID()}`;
    const queue = new Queue(name, { connection }, admissionBackend(3, 1));
    queue.on("error", () => {});
    let child, replacement;
    try {
      await queue.add(
        "run",
        { userId: "owner", marker: "original" },
        { jobId: "original" },
      );
      child = fork(
        new URL("../fixtures/crashing-worker.mjs", import.meta.url),
        [name, String(connection.port)],
        { stdio: ["ignore", "ignore", "ignore", "ipc"] },
      );
      assert.equal(await activated(child), "original");
      await kill(child);
      assert.equal(await queue.getActiveCount(), 1);
      await sweep(queue);
      await assert.rejects(
        queue.add("run", { userId: "owner" }, { jobId: "bypass" }),
        /OWNER_QUEUE_FULL/,
      );

      const recovered = [],
        errors = [];
      replacement = new Worker(
        name,
        async (job) => {
          recovered.push({ id: job.id, marker: job.data.marker });
          return { success: true, marker: job.data.marker };
        },
        {
          connection,
          lockDuration: 500,
          stalledInterval: 100,
          maxStalledCount: 1,
        },
      );
      replacement.on("error", (error) => errors.push(error.message));
      const completed = await until(
        () => queue.getJob("original"),
        (job) => !!job?.finishedOn,
        "Stalled job was not recovered",
      );
      assert.equal(await completed.getState(), "completed");
      assert.equal(completed.attemptsStarted, 2);
      assert.deepEqual(recovered, [{ id: "original", marker: "original" }]);
      assert.deepEqual(completed.returnvalue, {
        success: true,
        marker: "original",
      });
      assert.deepEqual(errors, []);
      await replacement.close();
      replacement = null;
      await sweep(queue);
      const client = await queue.getBackend().client;
      assert.equal(await client.exists(queue.toKey("owner:owner")), 0);
      await queue.add("run", { userId: "owner" }, { jobId: "after-recovery" });
    } finally {
      await kill(child);
      if (replacement) await replacement.close(true);
      await queue.obliterate({ force: true });
      await queue.close();
    }
  },
);

test(
  "production shutdown drains an active real Redis job without starting waiting work",
  { timeout: 15000 },
  async () => {
    const name = `drain-${randomUUID()}`;
    const queue = new Queue(name, { connection }, admissionBackend(3, 1));
    queue.on("error", () => {});
    let release;
    const active = new Promise((resolve) => {
      release = resolve;
    });
    const started = [],
      errors = [];
    const worker = new Worker(
      name,
      async (job) => {
        started.push(job.id);
        await active;
        return { drained: true };
      },
      { connection, concurrency: 1 },
    );
    worker.on("error", (error) => errors.push(error.message));
    let disconnected = 0;
    try {
      await queue.add("run", { userId: "first" }, { jobId: "active-job" });
      await until(
        () => started.length,
        (n) => n === 1,
        "Job did not activate",
      ).catch((error) => {
        throw Error(error.message + ": " + JSON.stringify(errors));
      });
      await queue.add("run", { userId: "second" }, { jobId: "waiting-job" });
      const shutdown = createShutdown({
        workers: [worker],
        socket: {
          disconnect: () => {
            disconnected++;
          },
        },
        graceMs: 5000,
        log: { info() {}, error() {} },
      });
      const stopped = shutdown();
      assert.equal(
        shutdown(),
        stopped,
        "Repeated signals share the shutdown promise",
      );
      await until(
        () => worker.isPaused(),
        Boolean,
        "Worker did not pause intake",
      );
      assert.equal(await queue.getActiveCount(), 1);
      assert.equal(await queue.getWaitingCount(), 1);
      release();
      assert.equal(await stopped, 0);
      assert.equal(disconnected, 1);
      assert.deepEqual(started, ["active-job"]);
      assert.equal(
        await (await queue.getJob("active-job")).getState(),
        "completed",
      );
      assert.equal(
        await (await queue.getJob("waiting-job")).getState(),
        "waiting",
      );
      assert.deepEqual(errors, []);
    } finally {
      release();
      await worker.close(true);
      await queue.obliterate({ force: true });
      await queue.close();
    }
  },
);

test(
  "repeated worker crashes exhaust stalled recovery and release the owner slot",
  { timeout: 20000 },
  async () => {
    const name = `stall-limit-${randomUUID()}`;
    const queue = new Queue(name, { connection }, admissionBackend(3, 1));
    queue.on("error", () => {});
    const children = [],
      processed = [],
      errors = [];
    let replacement;
    try {
      await queue.add("run", { userId: "owner" }, { jobId: "repeated-crash" });
      for (let crash = 0; crash < 2; crash++) {
        const child = fork(
          new URL("../fixtures/crashing-worker.mjs", import.meta.url),
          [name, String(connection.port)],
          { stdio: ["ignore", "ignore", "ignore", "ipc"] },
        );
        children.push(child);
        assert.equal(await activated(child), "repeated-crash");
        await kill(child);
      }
      await sweep(queue);
      await assert.rejects(
        queue.add("run", { userId: "owner" }, { jobId: "before-terminal" }),
        /OWNER_QUEUE_FULL/,
      );
      replacement = new Worker(
        name,
        async (job) => {
          processed.push(job.id);
          return { unexpected: true };
        },
        {
          connection,
          lockDuration: 500,
          stalledInterval: 100,
          maxStalledCount: 1,
        },
      );
      replacement.on("error", (error) => errors.push(error.message));
      const job = await until(
        () => queue.getJob("repeated-crash"),
        (job) => !!job?.finishedOn,
        "Repeatedly stalled job did not fail",
      );
      assert.equal(await job.getState(), "failed");
      assert.match(job.failedReason, /stalled more than allowable limit/);
      assert.deepEqual(processed, [], "Exhausted jobs must not execute again");
      assert.deepEqual(errors, []);
      await replacement.close();
      replacement = null;
      await sweep(queue);
      const client = await queue.getBackend().client;
      assert.equal(await client.exists(queue.toKey("owner:owner")), 0);
      await queue.add("run", { userId: "owner" }, { jobId: "after-terminal" });
    } finally {
      await Promise.all(children.map(kill));
      if (replacement) await replacement.close(true);
      await queue.obliterate({ force: true });
      await queue.close();
    }
  },
);
