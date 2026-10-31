# Local page loading and authentication timing review

22 October 2026, Asia/Kolkata. Baseline f165cdd9628900ed925aa2b66918e6592128a43b. The real local Next.js web app and BullMQ worker were started before the measurements, using ephemeral development secrets. Requests were made to http://127.0.0.1:3000; only the processes created by this diagnostic were stopped afterward. No users were created and no authentication or application dependencies were mocked.

## Main findings

The measured slowest sign-in-related component was the unavailable database retry path at 6.14 seconds, tested directly at service level. The first homepage request took 5.00 seconds. Actual HTTP sign-in attempts took 4.03 and 3.03 seconds before being rejected by the unavailable Redis rate limiter. These are different paths and must not be summed into one supposed successful login time.

The environment cannot complete sign-up or sign-in: no real database configuration, Redis or Docker is present; readiness is 503 with zero healthy execution workers. Browser Chromium is not installed. HTTP server timings below are not visual page-loading, LCP, hydration or logged-in dashboard readiness measurements.

## Page response measurements

The first request is the first request to that route in this server process. Existing Next development caches were retained, so it is not a clean production cold-start experiment. Each route has one first request and two repeats, requested sequentially with no parallel load. Total time includes consuming the HTML response body; TTFB is recorded separately in http-timings.json.

| Page | First response ms | Mean of two repeats ms | Wire HTTP status | Rendering assessment |
|---|---:|---:|---:|---|
| / | 5004.37 | 66.88 | 200 | Render error detected |
| /login | 78.11 | 53.50 | 200 | Render error detected |
| /signup | 386.97 | 50.89 | 404 | Render error detected |
| /student | 510.42 | 52.21 | 200 | Render error detected |
| /student/practicals | 379.64 | 56.28 | 200 | Render error detected |
| /faculty | 482.78 | 43.95 | 200 | Render error detected |
| /admin | 1549.60 | 43.12 | 200 | Render error detected |
| /practice | 432.46 | 60.23 | 200 | Render error detected |

The homepage's first TTFB was 4990.63 ms out of 5004.37 ms total: almost all of that request occurred before response headers, rather than during HTML transfer. Next's server log attributes about five seconds to Next.js and only a few milliseconds to application code for that failed response. This supports development framework/render startup as the cause of this particular slow request; it does not establish the production homepage bottleneck.

The returned HTML contains an error marker, and server logs repeatedly report ENOENT uv_resident_set_memory and page-render status 500 even though headers observed by the HTTP client were 200. All listed page responses were classified as render failures by a heuristic marker check, corroborated by server errors. Therefore a repeat response of 40–70 ms is a fast response carrying a failed render, not evidence of a healthy UI. Protected pages were requested without login and do not represent successful authenticated dashboards. The missing signup page legitimately returns 404.

## Sign up and account creation

There is no public /signup page and no /api/auth/signup endpoint in this baseline. Local probes returned 404 for both. Student and faculty accounts are provisioned by an administrator through POST /api/users, calling UserManagementService.mutate.

The measured unauthenticated POST /api/users took 528.69 ms and returned 401. This measures compilation/access rejection only. It does not measure password hashing, a committed user insert or usable account creation. Valid admin credentials and a disposable, migrated database are required to measure successful creation. Do not interpret the 528.69 ms value as signup time.

The implemented create flow is: current admin authentication query, payload checks, bcrypt cost-10 hashing, then coderank_manage_user database function. The function rechecks admin authority and uses an advisory transaction lock. Under concurrent provisioning, lock wait and database work must be measured separately from hashing. Source: apps/web/src/app/api/users/route.js; packages/core/src/modules/users/UserManagementService.js; database/migrations/004_user_management.sql.

## Sign in HTTP measurements

| Request | Total ms | Result | Interpretation |
|---|---:|---|---|
| Valid-shaped login attempt 1 | 4025.93 | 429 | First route compilation plus unavailable rate limiter; no valid login measured |
| Valid-shaped login attempt 2 | 3028.68 | 429 | Warm request still spends about three seconds waiting for unavailable Redis |
| Invalid login payload | 23.76 | 400 | Early validation rejection; it avoids the dependency path |

The payload used the reserved example.invalid domain and a non-account test password. These probes cannot establish valid user authentication performance.

The rate limiter returns allowed:false and unavailable:true when Redis is down. The login route handles every allowed:false as 429 and returns “too many login attempts,” without distinguishing unavailable:true. This is an error-classification defect and an explanation for the misleading sign-in message. Preserve fail-closed behavior while returning an appropriate service-unavailable response and recovery message; do not bypass throttling to make the test succeed.

## Isolated component timings

The following were measured sequentially after the HTTP run, using actual code and real unavailable dependency calls. They were not performed under load.

| Component | Samples | Median ms | p95 ms | Meaning |
|---|---:|---:|---:|---|
| bcrypt password hash, cost 10 | 10 | 181.99 | 859.76 | Password creation primitive only |
| bcrypt password comparison | 10 | 143.54 | 1196.43 | Successful local hash comparison only |

With ten samples the nearest-rank p95 equals the maximum. Shared runtime scheduling and warmup can affect these small-sample results; they are not production authentication SLOs. Do not lower password-hash strength based on this run.

- Direct Redis-backed login limiter: 3083.19 ms, allowed:false/unavailable:true.
- Direct UserService.login database-failure path: 6142.82 ms, status 503. This direct diagnostic intentionally isolates the service from the HTTP limiter; it did not produce a session or write a user.

The database wrapper retries recognized connection failures up to three attempts with 500/1000 ms backoff. UserService.login wraps that in another three-attempt loop with its own 500/1000 ms backoff. This can produce up to nine DB attempts and six seconds of explicit backoff when the connection fails immediately: three inner sequences of 1.5 seconds plus 1.5 seconds outer backoff. The measured 6.14-second failure is consistent with that structure. This retry multiplication is a stronger supported explanation for unavailable-database login delay than password hashing in this environment.

A successful ordinary login instead includes user lookup, password comparison, conditional session rotation/activity-log write, token generation, then a full-page role redirect. The UI uses window.location.href, so end-to-end sign-in includes the subsequent dashboard navigation and its data requests. None of those success-path totals were measured here.

## Current health

Liveness returned 200 in 401.26 ms. Initial readiness returned 503 in 1727.14 ms; the immediate cached 503 took 36.28 ms. Database schema was unknown/degraded, queue unavailable and healthyWorkers zero. Fast cached health failures must not be reported as readiness success.

## Recommended order of work

1. Restore the configured Neon/Postgres database, Redis and runner services. Require real readiness success before authenticated timing. Resolve the restricted host memory-inspection error on a normal build/browser-capable runner.
2. Correct the unavailable-Redis response mapping without weakening authentication or throttling. Give sign-in a bounded deadline and actionable inline service-unavailable recovery.
3. Consolidate the nested login/DB retry policy into one bounded budget. Retry only safe transient operations; preserve definitive session/transaction completion and avoid duplicate writes.
4. Re-run the same routes in a production build. Capture at least 20 successful login/account-creation samples for each relevant warm/cold condition and report sample sizes. Preserve passwords/hashes/tokens; never put them in timing logs.
5. Capture real browser navigation timing, LCP and interaction readiness. Measure login submit to session response separately from response to dashboard ready. For admin creation, measure auth, validation, hashing, DB/lock wait, commit and visible confirmation.

This is the baseline phase described by the attached change plan. The later keyboard/draft/results chunks are not implemented as part of this timing review. No production page-speed, successful signup time, successful login time or 200-user capacity result is claimed.

## Evidence and reproduction

- http-timings.json: all 32 HTTP requests, TTFB, full-body duration and error markers.
- auth-component-timings.json: password primitive and dependency-failure component timings.
- web.log and worker.log: real process errors and request diagnostics.
- scripts/profile-local-pages.mjs: repeatable sequential local HTTP profiler; PROFILE_BASE_URL can target an already-running local instance without owning its processes.
- scripts/profile-auth-components.mjs: isolated authentication component probe. Run only in a disposable test environment with the intended configuration; a configured service call may read the real database.

No credentials, password hashes, source code or hidden-case data are recorded in these result files.
