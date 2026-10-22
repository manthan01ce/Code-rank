import benchmark from "./runner-concurrency-benchmark.js";
import { sleep } from "k6";

// Use the same output-verified completion contract as the capacity benchmark.
export const options = {
  stages: [
    { duration: "15s", target: 20 },
    { duration: "30s", target: 80 },
    { duration: "1m", target: 150 },
    { duration: "15s", target: 0 },
  ],
  thresholds: {
    runner_completion_rate: ["rate>0.95"],
    runner_end_to_end_ms: ["p(95)<10000"],
    runner_completions: ["count>0"],
  },
};

export default function () {
  benchmark();
  sleep(1);
}
