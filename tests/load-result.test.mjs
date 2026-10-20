import test from "node:test";
import assert from "node:assert/strict";
import { successfulExecution } from "../load-tests/lib/execution-result.js";

test("capacity measurement requires successful execution and the expected output", () => {
  const job = {
    status: "completed",
    result: { success: true, exitCode: 0, stdout: "expected\n" },
  };
  assert.equal(successfulExecution(job, "expected"), true);
  assert.equal(
    successfulExecution({ ...job, status: "failed" }, "expected"),
    false,
  );
  assert.equal(
    successfulExecution(
      { ...job, result: { ...job.result, success: false } },
      "expected",
    ),
    false,
  );
  assert.equal(
    successfulExecution(
      { ...job, result: { ...job.result, exitCode: 1 } },
      "expected",
    ),
    false,
  );
  assert.equal(successfulExecution(job, "different"), false);
  assert.equal(successfulExecution({ status: "completed" }, "expected"), false);
});
