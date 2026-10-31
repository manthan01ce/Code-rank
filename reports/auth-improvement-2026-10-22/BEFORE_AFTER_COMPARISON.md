# CodeRank authentication changes and before after comparison

22 October 2026, Asia/Kolkata. Baseline: f165cdd9628900ed925aa2b66918e6592128a43b and reports/auth-page-review-2026-10-22/AUTH_AND_PAGE_TIMING_REVIEW.md. Candidate work is on fix/bounded-auth-and-performance-comparison. These changes are in a draft PR and have not been deployed to the public website.

## Outcome

Implemented the failure-path fixes, bounded read retry policy, private timing instrumentation and a production-mode browser comparison workflow. Re-ran the same sequential local HTTP and component probes. Unavailable-dependency responses are substantially faster and correctly classified. The local stack is still not healthy because its configured DB/Redis/Docker services are absent, and production/browser success-path measurements are pending CI. No successful login/account-creation, production page-speed or capacity improvement is claimed from failure timings.

## Measured local comparison

Same baseline scripts, endpoints and unavailable dependency conditions. Each HTTP row is one observation, not a percentile or production SLO.

| Observation | Before ms | After ms | Outcome |
|---|---:|---:|---|
| First unavailable sign-in request | 4025.93 | 172.73 | 429 becomes 503; first request also includes development compilation |
| Repeat unavailable sign-in request | 3028.68 | 26.35 | 99.13% lower observed duration; correct service-unavailable response |
| Isolated Redis unavailable check | 3083.19 | 49.72 | 98.39% lower observed duration; remains fail closed |
| Isolated DB-failure login service | 6142.82 | 782.97 | 87.25% lower observed duration; still 503, not a successful login |

The password hash cost remains bcrypt 10. Its timing changed with host scheduling and warmup; no password-strength reduction or claimed hash optimization was made.

| Page response | Before first ms | After first ms | Interpretation |
|---|---:|---:|---|
| Homepage | 5004.37 | 402.91 | Both carry render-error evidence; development caches retained. Cannot attribute the difference solely to the font change. |
| Login | 78.11 | 68.75 | Failed-render responses, not visual readiness. |

Repeated homepage responses are still around 54–80 ms after the change. The runtime continues to log ENOENT uv_resident_set_memory. Production build fails with that host error after removing the Google font dependency. The public deployment has not been repaired by these code changes.

## Changes implemented

### Correct unavailable Redis handling

POST /api/auth/login now distinguishes limiter unavailable from actual throttling. Redis failure returns 503, Retry-After: 5 and no-store; actual rate exhaustion retains 429 with Retry-After. The limiter keeps fail-closed login/run/submit behavior. It disables offline command queuing, avoids connection-retry stalls and bounds connection/command waits. The UI displays inline recovery rather than a misleading attempt-limit message.

### Bound sign in without automatic replay

The UI uses one request lock and a 12-second deadline covering response/body consumption, aborts waiting on navigation, and does not automatically replay login. A timeout warns that the request may have completed. The client deadline does not falsely imply that a server-side session write was cancelled. No credentials are written to timing artifacts.

### Remove nested database retry multiplication

The login lookup explicitly opts into one read-only retry budget: at most three transient-connection attempts in 2500 ms with 250/500 ms backoff. Authorization/query errors are not retried. Generic tagged queries, writes and transactions no longer automatically replay after a connection failure. This avoids repeating an uncertain account creation, session write or database function mutation. Native transactions still await definitive completion. Existing driver/query timeout semantics for other operations remain; an error is not proof that a timed-out write failed to commit.

### Remove external font download dependency

The root layout no longer downloads Inter via next/font/google. The global font stack has system fallbacks, so builds do not require Google's font endpoint. This can alter typography on hosts without Inter and needs normal browser visual verification. The host memory-inspection error was not hidden by stubbing memory metrics or weakening readiness.

### Capture independent duration phases

Standard Server-Timing headers expose durations only. Login: rate_limit, lookup, password_compare, session_commit. Account creation: auth, validation, password_hash, database_commit. Headers exclude account identifiers, SQL, tokens, passwords and returned credentials.

The database_commit span combines network time, DB function work, lock waiting and commit. Separate engine-level lock and commit timing remains unimplemented; no false separation is reported. Browser tests measure session response separately from dashboard readiness and creation response separately from visible confirmation/PDF generation. LCP is an observed value at capture, not a guaranteed finalized field measurement.

## Production comparison workflow

Authentication performance comparison runs baseline and candidate on normal Ubuntu runners with real disposable PostgreSQL, Redis, Docker runners, production builds and Chromium. Both revisions use the same harness. Per revision, the harness requests:

- 20 successful UI sign-ins with fresh browser contexts and 20 with reused contexts.
- 20 successful administrator UI account creations in each browser condition.
- Login page navigation timing, observed LCP, submit-to-session-response, response-to-dashboard-ready, and creation response/visible-confirmation durations.

Fresh browser contexts mean cold browser storage/cache; server and database processes remain warm. True application/database-cold sampling is outstanding. Performance traces/screenshots/videos are disabled to avoid persisting credentials; generated credential PDF downloads remain ephemeral and are not copied to reports. Test accounts live only in a randomly named disposable loopback database that is dropped after the run.

Current run: https://github.com/manthan01ce/Code-rank/actions/runs/39814763318. At review time both measurement jobs were queued and had no completed steps; no successful samples are fabricated. A later candidate commit may supersede this initial run. The ordinary Architecture checks run was also queued. Successful measurement artifacts, if available, must be compared using scripts/compare-auth-performance.mjs, which requires exactly 20 finite successful values per condition.

## Verification

- Full strict unit gate: 177 tests passed, zero failures/skips.
- Critical lint passed with zero warnings allowed.
- Focused final regressions: six tests passed after the final cleanup; they cover 503/429 mapping, fail-closed behavior, bounded read retries, stalled sign-in abort and no automatic replay of uncertain writes/transactions.
- New browser measurement specification passes targeted lint and syntax checks; it has not yet executed in this workspace because Chromium and the real services are unavailable.
- Production build was attempted and remains blocked by ENOENT uv_resident_set_memory.
- Local health remains degraded. This is reported honestly rather than relaxed for testing.

## Completion against the requested work

| Requested work | Status |
|---|---|
| Restore public Neon/Postgres, Redis and runner services | Blocked: no configured production credentials/services. Neon and Vercel integrations were found but are not installed/connected. |
| Verify on normal production/browser runner | CI workflow prepared and queued; not yet verified. |
| Fix Redis mapping and bounded inline sign-in recovery | Implemented and locally tested. |
| One safe retry budget, no mutation replay | Implemented and tested. |
| 20 successful samples per warm/cold condition | Harness prepared for fresh/reused browser conditions; successful results pending; server/DB-cold runs still required. |
| Browser LCP, navigation and interaction readiness | Measurement harness prepared; real results pending. |
| Separate auth/validation/hash/DB and visible confirmation | Duration instrumentation implemented; engine-level lock/commit split still outstanding. |
| Compare previous report against candidate | Local outage-response comparison completed; successful production comparison pending. |

The next necessary external actions are production Neon/Vercel access and an available normal CI runner. Neither source changes nor a passed unit suite establish production readiness. Do not merge/deploy based solely on the local fast-failure numbers.
