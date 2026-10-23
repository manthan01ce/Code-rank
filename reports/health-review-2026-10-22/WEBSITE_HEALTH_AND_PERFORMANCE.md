# CodeRank website health and performance review

22 October 2026, Asia/Kolkata. Reviewed commit f165cdd9628900ed925aa2b66918e6592128a43b from origin/master. The repository's default branch is master, not main. Pulled with git pull --ff-only origin master; prior workspace changes remain preserved in the named Git stash. This review uses the pulled code without reapplying older changes.

## Assessment

The configured public deployment is unavailable. The local web process can start, but the complete application is not ready: the database and Redis are unavailable, there are zero healthy execution workers, and Docker is absent. A new local smoke fails. These availability failures must be corrected before measuring production performance or supporting 200 students.

Current code quality gates pass, but browser rendering and the production build cannot be verified in this runtime. No authenticated database timing, real Docker execution timing, production Core Web Vitals, or 200-user throughput result is claimed.

## Current verification results

| Check | Result | Evidence and interpretation |
|---|---|---|
| Source synchronization | PASS | Fast-forward pulled master to f165cdd. |
| Public deployment | FAIL | GET https://code-rank-two.vercel.app/api/health returned HTTP 404, x-vercel-error DEPLOYMENT_NOT_FOUND; deployment checker also rejected 404. |
| Initial local listener | Unavailable | No service answered localhost:3000 before diagnostics. |
| Diagnostic local startup | Partial | Real web/worker processes started with ephemeral development secrets; no dependency mocks. |
| Local readiness | FAIL | HTTP 503; database schema unknown/degraded, Redis queue degraded, execution degraded, healthyWorkers 0. |
| Local configuration | Missing | No DATABASE_URL or JWT_SECRET in the environment, no application environment files; Docker executable/socket and Redis executable absent. |
| Fresh k6 smoke | FAIL | 1 VU maximum, 5 completed iterations, 23 HTTP requests; 6 HTTP failures (26.09% rounded), 11/50 failed checks, p95 1449.89 ms; exit 99. |
| Unit gate | PASS | 172 tests, zero failures/skips; 36.21 seconds. |
| GitHub CI on reviewed commit | PASS | Architecture checks completed successfully: https://github.com/manthan01ce/Code-rank/actions/runs/39730911884. This is CI evidence, not proof of deployed health. |
| Critical lint | PASS | npm run lint:critical completed with zero warnings allowed. |
| Production build | Blocked by runtime | npm run build --workspace=@coderank/web -- --webpack failed with ENOENT uv_resident_set_memory. This is not evidence of a successful production build. |
| Browser/visual/accessibility | Unverified | Dev rendering also logs the memory-inspection error; Google font fetch failed in this network. Passing HTTP page checks do not establish a usable page. |
| Redis/Postgres/Docker integration | Blocked | Required real dependencies are not available; unit tests do not substitute for them. |

The diagnostic ran from 21:22:21 to 21:22:47 IST on 22 October. Stages were overridden to 1 second ramp to 1 VU, 5 seconds at 1 VU, then 1 second ramp down. Results include setup/cold compilation traffic. Server logs separately recorded degraded health responses of 2160 ms and 1590 ms, then cached failures as low as 15 ms; request-duration-samples.json preserves those samples. This is an unhealthy development-mode smoke, not a production latency baseline. Public-page checks in the legacy smoke only inspect status, and queue checks permit HTTP 503; those passes are weaker than readiness. All diagnostic processes were stopped afterward.

## Processes that consume time

Evidence labels below distinguish observed behavior from code-derived risk. The ranked list identifies where to instrument and optimize; it does not claim measured production contribution percentages.

### 1 Draft save is on the run and submission critical path

Source: apps/web/src/components/compiler/WorkspaceLayout.js, handleSaveCodeToDB and performAction; apps/web/src/app/api/student/workspaces/save/route.js; packages/core/src/modules/submissions/SubmissionService.js; packages/core/src/security/active-actor.js; packages/core/src/modules/practicals/PracticalService.js.

Run and Submit await the save before enqueueing. The save has an 8-second browser request budget and performs current-user authentication, practical lookup, student-profile authorization and workspace upsert. The enqueue request repeats authentication and practical/profile authorization. For a normal student practical, these two requests account for seven database queries before queue insertion, excluding middleware and worker grading. This serialized network chain is a strong code-derived latency candidate, not a measured database profile.

Change: capture and durably preserve the exact local draft immediately; skip an unchanged server save using an acknowledged revision, and decide explicitly whether background sync or an enqueue-and-save server contract can preserve the same guarantees. Maintain permission checks and account-revocation behavior. Measure save and enqueue spans before choosing the implementation. Acceptance: one job per action, correct source revision, actionable save failure, no lost drafts.

### 2 Polling multiplies database authentication traffic

Source: apps/web/src/lib/job-lifecycle.js, waitForJob; apps/web/src/app/api/jobs/[jobId]/route.js; apps/web/src/lib/execution-api.js; packages/core/src/security/active-actor.js.

The active workspace imports job-lifecycle.js and polls every 750 ms. Each authenticated status request revalidates the account/session in Postgres, then reads the job and its state in Redis. With 200 simultaneously waiting clients and negligible request latency, the cadence approaches 267 polls and authentication queries per second, in addition to real workload. Actual rates fall as request time rises. A separate socket-assisted helper exists in wait-for-job.js, but this workspace does not use it.

Change: consolidate the lifecycle, use correctly scoped socket notifications to prompt authoritative refresh, and use adaptive polling with jitter/hidden-tab backoff as fallback. Do not remove ownership checks or cache away the current-session revocation guarantee. Acceptance: final result is correct after dropped/duplicate notifications and reconnects, terminal errors end the wait, and polling/authentication traffic drops measurably.

### 3 Sandbox startup and sequential Docker calls

Source: packages/runner/src/Executor.js and Sandbox.js; packages/core/src/modules/submissions/GradingService.js.

The current default runner starts a disposable container, compiles/prepares once, executes cases one by one via Docker exec, cleans the workdir, and removes the container. A call-count trace using the injected Docker transport confirmed N+4 commands: 1 case uses 5, 5 cases use 9, 10 cases use 14, and 20 cases use 24. No real containers ran for that trace. The earlier report's single-batch-invocation optimization no longer describes this active path.

Change: measure sandbox startup, compile, each case and cleanup separately. Explore collecting a bounded batch in one invocation while preserving individual timeouts, exit status, output limits, isolation, cancellation, resource accounting and whole-job lifetime. Avoid restoring shared unsafe workdirs or enabling warm daemons solely for speed. Acceptance: identical grading and containment behavior for loops, crashes, fork/output abuse and same-source concurrency, with a measured turnaround improvement on identical hardware and fixtures.

### 4 Queue wait under bursts

Source: apps/worker/src/workers/submission.worker.js; packages/queue/src/index.js; packages/runner/src/Sandbox.js.

Default worker concurrency is 8, while each disposable sandbox may use up to 1 CPU/512 MiB. Two hundred enqueued jobs therefore require about 25 waves at that setting. If measured average service time is S seconds, an idealized last wave is around 25S before other overhead; this is capacity arithmetic, not a result. Raising concurrency without CPU/memory headroom can make latency worse.

Change: record queue wait and worker service time separately, profile each language/case mix, then size replicas/concurrency against actual resources. Keep admission/rate limits. Acceptance: at the agreed 200-user profile, queue wait remains bounded without rising resource pressure or failed accepted jobs.

### 5 Database retries and request budgets differ

Source: packages/database/src/client.js and timeout.js; apps/web/src/lib/job-lifecycle.js.

Database calls default to a 30-second timeout. Recognized connection failures can retry twice with 500 ms and 1000 ms backoff, adding 1.5 seconds plus connection attempts. A browser save can stop waiting at 8 seconds while server-side work continues; Promise.race timeout wrappers do not inherently cancel a database query. Slow Neon wakeup/network paths may therefore affect several consecutive requests.

Change: introduce end-to-end phase spans and align route, client and query budgets. Preserve definitive completion for transactions and use revision/idempotency semantics for uncertain retries. Benchmark pooled/native transport in the actual deployment before changing driver. Acceptance: timeout messages describe uncertain completion honestly; retries cannot duplicate submissions or overwrite newer drafts.

### 6 Page load and secondary interactions

Source: apps/web/src/app/student/code/[id]/page.js; apps/web/src/lib/fetch-collection.js; WorkspaceLayout.js handleLangChange; apps/web/src/app/layout.js.

Practical metadata and page rendering each issue their own database lookup; no explicit shared loader deduplication is present. fetchCollection drains cursor pages sequentially before returning. Language switching saves the outgoing draft and then uses an unbounded fetch to load the incoming language. Inter uses next/font/google, which failed to fetch in this build/dev network. The font warning is a build/development dependency, not proof of a browser request to Google on every production navigation.

Change: share a request-scoped practical loader after access-policy review; use page UI/search selectors for large collections; bound and abort language loads; self-host or bundle approved fonts for offline/reliable builds. Measure page/collection sizes and first editor-ready time before prioritizing bundle work.

## What is already improved

Current master already contains atomic queue admission with per-owner limits, bounded producer retries, account/session revalidation, fresh worker heartbeat readiness, transactional/idempotent attempt persistence, correct sample verdicts, immediate action feedback, duplicate-action locking, and a 60-second job-wait deadline. These remain protections to preserve. Old warnings about non-atomic enqueue and count-based attempt numbering should not be treated as current defects.

## Improvement and verification order

1. Restore a reachable deployment and real DB/Redis/worker/runner configuration. Require /api/live 200 and /api/health 200 with fresh schema/worker readiness.
2. Instrument save, authentication/authorization, enqueue, queue wait, container start, compile, case execution, persistence and result visibility. Carry an opaque request/job ID; do not log tokens, source or hidden data.
3. Reduce the save-before-enqueue chain and excessive polling; validate one-job-per-action and revocation/ownership correctness.
4. Optimize sandbox invocation overhead only after real measurements and safety/correctness regression checks.
5. Run smoke, then 20/50/100/200 VUs with distinct students and representative Python/C++/Java cases; include a 200-submission burst and soak/recovery exercises.

Proposed gates: all functional checks pass, HTTP failures below 1%, no dropped iterations, enqueue/read p95 below 1 second, completed-job p95 below 15 seconds/p99 below 30 seconds. These targets are not achieved by this review. Browser targets such as LCP and interaction responsiveness require real production/browser traces.

## Evidence files

This folder contains local/diagnostic.json, local/smoke-summary.json, local/k6-smoke.log, local/web.log, local/worker.log, unit-tests.log, lint-critical.log, build.log and sandbox-call-trace.json. Historical 20 October results remain in their original reports and are not relabeled as current measurements. The accompanying UI_UX_CHANGE_SPECIFICATION.md and editable Word document define the next UI changes and acceptance tests.
