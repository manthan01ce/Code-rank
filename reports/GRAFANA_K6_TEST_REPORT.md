# CodeRank Grafana k6 test report and improvement plan

Date: 2026-10-20 (Asia/Kolkata). Historical logs are repository artifacts, not new tests of the changed code. This session uses local Grafana k6 v1.3.0; there is no connected Grafana Cloud results dashboard.

## Executive assessment

Historical results are poor for smoke latency and execution reliability. The fast API test does not establish code-execution capacity. Current end-to-end qualification is blocked: the configured public deployment previously returned DEPLOYMENT_NOT_FOUND; a fresh connection attempt timed out. A diagnostic local web server starts but health returns HTTP 503: database unreachable and Redis ECONNREFUSED at 127.0.0.1:6379. Docker is unavailable. Do not claim support for 200 active students until the strict suite passes with distinct authenticated fixtures.

## Available historical results

| Test and evidence | Recorded load | Recorded result | Assessment and limits |
|---|---|---|---|
| load-tests/reports/01-smoke-test-results.txt | 20 VUs, 240 HTTP requests | p95 12.09 s; average 1.89 s; max 13.76 s; HTTP failures 0%; 360/360 checks passed | Latency FAILED the log's p95 <800 ms gate, by about 15.1×. Passing functional checks do not make this a performance pass. |
| load-tests/reports/02-api-load-test-results.txt | Up to 150 VUs; 43,890 HTTP requests; 356.38 requests/s | p95 37.11 ms; HTTP failures 0%; 87,750/87,750 checks passed | Recorded thresholds passed. Mainly page/health/queue reads and expected unauthenticated rejection; no proof of authenticated grading throughput. |
| load-tests/reports/03-execution-stress-test-results.txt | Configured 150 max VUs; observed max 149; 6,291 HTTP requests | HTTP failures 99.47% (6,258/6,291); only 15 accepted enqueue checks; overall checks 0.47% passing; HTTP p95 1.01 s | Reliability FAILED decisively. Fast errors dominate latency; request p95 is not execution turnaround. Logs lack response-status breakdown and resource telemetry, so root cause remains unproven. |
| smoke-test-results.txt (root) | Configured 100 max VUs; observed max 76; 3,528 HTTP requests | p95 7.72 ms, average 455.98 ms, max 3m48s; HTTP failures 0.05%; 8 failed checks; 75 interrupted iterations | Severe tail latency and incomplete workload despite attractive p95. Not evidence of a healthy 100-user run. |
| load-tests/reports/smoke-test-result.json | Raw historical metric stream | Retained raw data, not an independent run | Do not count as a separate test pass or infer current results from it. |

Historical execution failures could include throttling: the script can use one shared JWT or anonymous bucket while sending approximately 52 HTTP requests/s. This is a hypothesis from the script, not a demonstrated failure cause; the log does not show whether responses were 429, 401, 503 or other errors. It also labels failed jobs as “finished execution,” so completion is weaker than correctness.

## Current strict qualification and full script inventory

| Test/profile | Intended coverage | Current status |
|---|---|---|
| qualification.js MODE=smoke | One authenticated student; run samples; submit; wait for grading/persistence | Script inspected; public preflight failed. No successful current smoke. |
| MODE=api | Authenticated practical-list reads; 20→50→100→200 VUs; two-minute hold | Script inspected; execution blocked by target/credentials. |
| MODE=run | Known-correct sample executions at up to 200 VUs | Script inspected; execution blocked. |
| MODE=submission | Known-correct submissions at up to 200 VUs with final verdict and persistence | Script inspected; execution blocked. |
| MODE=concurrency | 200 VUs submit once each; all final results verified | Script inspected at 200 VUs; execution blocked. 200 VUs does not mean 200 worker slots. |
| smoke-test.js, smoke-test-optimized.js, smoke-test-100vu.js | Legacy smoke variants | Historical evidence above where available; no fresh execution. |
| api-load-test.js, execution-stress-test.js | Legacy API and execution profiles | Historical evidence above; no fresh execution. |
| submission-load-test.js | Legacy mixed student/faculty scenario | No result artifact found; some checks accept unauthorized responses. Superseded for qualification by strict profiles. |
| stress-test.js, max-users-test.js | Higher-load/maximum-users exploration | No verified result artifact found; not executed this session. |
| rate-limit-test.js | Rate-limit behavior | No verified result artifact found; not executed this session. |
| websocket-polling-test.js | Realtime/polling workload | No verified result artifact found; not executed this session. |
| runner-concurrency-benchmark.js | Direct runner benchmark (Node, not k6) | Requires Docker; not executable here. |
| PowerShell runners/wrappers | Launch scripts | Not independent workload results. |

## Improvements already implemented

- Practical batch result collection uses one Docker invocation rather than 1+3N invocations. Per-case timeout, exit-status checks and metrics replace zero-runtime and potentially misleading results. Actual speedup remains unmeasured.
- Run/Submit show Saving immediately, share a synchronous action lock, and use one captured source snapshot for save and enqueue.
- Shared request/job lifecycle bounds save, enqueue and polling; detects terminal errors; aborts waiting on navigation; shows Queued/Running from server state and elapsed time. A timed-out wait does not falsely claim the server job was cancelled.
- Sample verdicts depend on all cases passing, independently of score. Offline drafts distinguish device storage from server sync, with restoration and retry.
- Narrow-screen workspace views, accessible confirmation/settings dialogs, undo for draft replacement, visible focus and explicit clipboard policy begin the UX work.

## Evidence-led improvement plan

| Order | Action | What it resolves | Verification/exit gate |
|---|---|---|---|
| P0: restore environment | Supply working database connection, Redis, worker and rebuilt Docker runner images; configure actual deployment URL | Current health failure and inability to execute tests | Health 200 with healthy dependencies; authenticated correct Python/C++/Java submission persists. |
| P0: isolate errors | Record HTTP status counts by endpoint, queue reject/rate-limit counts and worker failures; use 200 distinct test users | Unexplained 99.47% historical execution failures | Explain all non-2xx responses; zero unauthorized fixtures; no accepted-but-unfinished jobs in smoke. |
| P0: verify correctness | Run strict smoke plus infinite-loop, nonzero-exit, compile-error and hidden-case checks after rebuild | Avoid optimizing misleading grading outcomes | All functional checks pass, correct persisted attempts, no leaked workdirs. |
| P1: separate latency | Measure save/enqueue, Redis admission, queue wait, compile, execution, DB persistence and result visibility | Historical 12.09-second p95 cannot identify its bottleneck | Phase histograms plus server CPU/RSS, DB latency/connections, Redis latency and queue depth. |
| P1: bound dependencies | Replace indefinite producer retry behavior with bounded failure; make queue admission atomic; test dependency loss | Hanging requests and queue over-admission risk | Dependency loss returns a bounded actionable failure; no duplicate enqueue; recovery smoke passes. |
| P1: capacity tuning | Test at 20/50/100/200 VUs; tune worker slots and add isolated runner capacity only when CPU/RSS/queue metrics justify it | Queue buildup; default 8 worker slots share constrained language daemons | At 200 VUs: HTTP errors <1%; all checks pass; enqueue/read p95 <1 s; turnaround p95 <15 s/p99 <30 s; no dropped iterations. |
| P1: persistence correctness | Test same-student concurrent submissions; audit attempt numbering and best-score case writes for atomicity | Cross-attempt result races under concurrency | Attempt identity and best-score/case breakdown remain consistent after forced simultaneous submits. |
| P2: resilience | Soak at validated peak, then restart a worker and interrupt Redis in staging; test draft recovery | Tail latency, resource growth and recovery risk | Stable queue/resources; bounded errors; documented recovery time; no lost accepted attempts or drafts. |

These gates are proposed qualification targets, not achieved results. Keep rate-limit correctness tests separate from capacity tests; do not disable production protections to manufacture a pass. Before/after comparisons must use the same fixtures, language mix, case count, code, hardware, deployment mode and warm/cold conditions. Archive k6 summaries plus server telemetry for each test.

## Session verification and server status

The full Node suite passes 35 tests including lifecycle terminal errors, timeout/navigation, sample verdicts and the batch shell regression. Targeted frontend lint has zero errors, with React migration warnings still present. A production build and development page rendering hit ENOENT uv_resident_set_memory in this restricted runtime; visual/browser validation is therefore outstanding. Health returned 503 with database and Redis errors. The diagnostic web process was stopped after the check. No production deployment was changed.

See load-tests/QUALIFICATION.md for executable commands and fixture format. No 200-user benchmark, production speedup, successful current smoke, or Grafana Cloud run is claimed.
