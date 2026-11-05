# Run/submit investigation

2026-10-20; baseline master a4c9a87.

## Findings and implemented changes

Practical Executor.runBatch used one Docker command to run cases followed by two Docker reads and an asynchronous cleanup command per case: 1+3N Docker CLI processes, excluding compile/final cleanup. The new path runs cases and collects framed results in one Docker process. This is a structural reduction, not a measured speedup.

The old batch had only a whole-batch timeout, swallowed failures, could pass empty expected output after execution errors, and reported runtime as zero. The replacement has per-case in-container timeouts, exit-status checks, elapsed/CPU/RSS metrics, capped output files and explicit incomplete-batch failures. Dynamic practical directories now clean up in finally, including exception paths. The runner image explicitly installs GNU time; rebuild before integration testing.

Other bottlenecks remain: the UI saves to the DB before enqueueing and before showing busy state; its polling loops have no deadline. Default worker concurrency is 8 and each language daemon shares 1 CPU/512 MiB. A 200-job burst necessarily queues. An illustrative 1-second service time at 8 slots needs roughly 25 waves; actual safe throughput requires measurement. Web producers use maxRetriesPerRequest:null, which may prolong Redis outage waits; queue admission and enqueue are separate operations. Follow-up should bound producer failure behavior and make admission atomic.

## Validation and limitations

- npm ci completed. Full Node suite: 24 tests passed with explicit test-only JWT and worker-service secrets. Initial run without JWT_SECRET failed environment initialization.
- New batch regression runs the actual generated shell with trusted local code through a Docker-command shim. It checks multiline/tab output, nonzero exit with empty expected output, timeout, subsequent-case execution, marks and metric parsing. GNU time output is stubbed because the host lacks it. Container isolation and real resource metrics were not tested.
- JavaScript syntax and Git whitespace checks passed.
- k6 profile inspection passed for smoke/API/run/submission/concurrency, including 200 VUs. Live smoke failed preflight because the configured deployment is unavailable. Full execution needs a reachable environment and 200 valid student fixtures.

No production timing baseline, Docker benchmark, successful smoke or 200-user capacity result is claimed. Batch output is bounded to 16 MiB; very large case sets/output can fail the batch and require staging sizing. Validate real mixed-language workloads after rebuilding containers. See load-tests/QUALIFICATION.md for commands/gates and UI_UX_IMPROVEMENT_REPORT.md for the prioritized UX work.
