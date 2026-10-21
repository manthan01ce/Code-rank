import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { successfulExecution } from "./lib/execution-result.js";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const JWT_TOKEN = __ENV.JWT_TOKEN || "";
const VUS = Number(__ENV.VUS || 8);
const DURATION = __ENV.DURATION || "30s";
const POLL_INTERVAL_SECONDS = Number(__ENV.POLL_INTERVAL_SECONDS || 0.25);
const MAX_WAIT_SECONDS = Number(__ENV.MAX_WAIT_SECONDS || 30);
const P95_TARGET_MS = Number(__ENV.P95_TARGET_MS || 10000);

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    runner_completion_rate: ["rate>0.95"],
    runner_end_to_end_ms: [`p(95)<${P95_TARGET_MS}`],
  },
};

const completions = new Counter("runner_completions");
const admissionRejected = new Counter("runner_admission_rejected");
const executionFailed = new Counter("runner_execution_failed");
const pollingErrors = new Counter("runner_poll_errors");
const completionRate = new Rate("runner_completion_rate");
const endToEnd = new Trend("runner_end_to_end_ms");

const headers = {
  "Content-Type": "application/json",
  ...(JWT_TOKEN ? { Authorization: `Bearer ${JWT_TOKEN}` } : {}),
};

export default function () {
  const startedAt = Date.now();
  const expected = `runner-benchmark-vu-${__VU}`;
  const body = JSON.stringify({
    language: "python",
    code: `print('${expected}')`,
    input: "",
  });

  const enqueue = http.post(`${BASE_URL}/api/execute`, body, {
    headers,
    tags: { name: "RunnerEnqueue" },
    timeout: "10s",
  });

  if (
    !check(enqueue, {
      "runner job accepted": (response) => response.status === 202,
    })
  ) {
    admissionRejected.add(1);
    completionRate.add(false);
    return;
  }

  const jobId = JSON.parse(enqueue.body).jobId;
  const deadline = Date.now() + MAX_WAIT_SECONDS * 1000;
  while (Date.now() < deadline) {
    sleep(POLL_INTERVAL_SECONDS);
    const status = http.get(`${BASE_URL}/api/jobs/${jobId}`, {
      headers,
      tags: { name: "RunnerPoll" },
      timeout: `${Math.max(1, Math.min(10000, deadline - Date.now()))}ms`,
    });

    if (status.status !== 200) {
      pollingErrors.add(1);
      if ([401, 403, 404].includes(status.status)) break;
      continue;
    }
    const job = JSON.parse(status.body);
    if (job.status === "completed") {
      const success = successfulExecution(job, expected);
      completionRate.add(success);
      if (success) {
        completions.add(1);
        endToEnd.add(Date.now() - startedAt);
      } else executionFailed.add(1);
      return;
    }
    if (job.status === "failed") {
      executionFailed.add(1);
      break;
    }
  }

  completionRate.add(false);
}
