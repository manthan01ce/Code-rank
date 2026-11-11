# CodeRank operations analytics — first release

`/analytics` is an independent read-only console. It does not use the admin layout, admin credentials, ordinary user tokens or browser localStorage. Its backend module is `/api/analytics/*`; only a separate analytics cookie grants access.

## Enable access

1. Review and apply migration `008_analytics_access.sql` using the normal migration/preflight process against the intended **local PostgreSQL** database. Do not migrate Neon without separate authorization.
2. In a private terminal at the repository root, run:

   ```sh
   npm run analytics:setup -- --origin https://your-coderank-host
   ```

   Choose a new password of at least 14 characters. The prompts hide input and write only a salted scrypt hash, a random session secret and the origin to `.env`. The file is restricted to its owner. No plaintext password is written or printed. Use `--env-file` for a different backend environment file; ensure a higher-precedence environment file does not override these values.
3. Restart the API. In managed hosting, transfer the three generated `ANALYTICS_*` values into the API's private environment. They must never be `NEXT_PUBLIC_*` settings or committed to git. The frontend needs only the existing same-origin API gateway.
4. Open `/analytics`. No default password exists. Missing/invalid configuration or inaccessible authentication storage fails closed.

The origin must match the browser's exact scheme, hostname and port. Public access requires HTTPS. Plain HTTP is allowed only for localhost/loopback development. Docker Compose passes the settings to the API, not to Next.js. Existing student, faculty and admin passwords are unaffected.

## Session and access controls

Passwords use salted scrypt and constant-time derived-key comparison. Login attempts are atomically limited in PostgreSQL to five per socket-address bucket per minute, including successful logins. Forwarding headers are not trusted for this bucket; reverse-proxied users may share a bucket. The cookie is host-only, HttpOnly, SameSite=Strict, scoped to `/api/analytics`, and Secure on HTTPS. Only a token hash is stored in the database.

Sessions expire after one hour, or after 15 minutes without an analytics request. Dashboard polling counts as activity. Password or secret rotation invalidates the version of all existing sessions. Logout deletes the server-side session; clearing the cookie is not the only revocation mechanism. Mutating access requests require the configured Origin and the analytics request header. Backend endpoints enforce their own session checks even when the page is bypassed.

Access logs record successful/failed logins, logouts and submission-detail reads. They do not contain passwords, session tokens, raw IP addresses or submitted source code.

## Views and measurement definitions

- **Overview:** schema readiness, worker/queue telemetry, current attention conditions, process-local HTTP metrics, API uptime and process memory.
- **Runners:** fresh/stale worker leases, concurrency, sampled occupied/available slots, active job references, worker CPU/RSS and counts of owned running sandbox containers.
- **Submissions:** paginated latest grades filtered by student/practical/course search, language and 1/7/30-day range. Detail reads include bounded source, case outcomes and the latest 50 completed attempts; opening a detail is audited.
- **Progress:** durable academic attempt totals, distinct submitting students, daily/language trends for 30 days and current course participation. These are not visitor counts, all Run clicks, or live-online users.
- **Access log:** latest 100 analytics access records.

Worker telemetry is sampled about every 10 seconds when idle, every two seconds while jobs run, and refreshed on job-state changes and becomes stale after 30 seconds. Stale records are retained briefly so the console can show a lost heartbeat. The dashboard polls a shared, coalesced API-process snapshot every five seconds and pauses network polling in hidden tabs. Its pause button stops automatic overview polling. Each panel shows snapshot time; monitoring is sampled rather than an atomic fleet-wide view.

An execution slot is worker concurrency capacity, not a pre-created container. Capacity totals are unknown when required telemetry is absent, stale, unhealthy or truncated. Running containers are read only on the worker using owner and CodeRank scope labels; the web/API has no Docker socket access. Process CPU is a percentage of one core. Database pool counts, host-wide CPU, per-container CPU/memory and execution-stage timing are not fabricated when instrumentation is unavailable.

Queue completed/failed counts cover retained BullMQ jobs, not lifetime throughput or grading correctness. The current worker is cold/per-job; this feature does not enable retired warm runners.

## Bounded retention maintenance

Preview a batch against an explicitly selected database:

```sh
npm run analytics:maintenance -- --target your_database
```

Apply only after reviewing the preview:

```sh
npm run analytics:maintenance -- --target your_database --apply --access-days 90
```

Each run considers at most 1,000 rows per table. It removes expired/idle sessions, login buckets older than two days and access records older than the selected 7–365-day policy (default 90). It never deletes academic submissions, grades or attempts. Schedule repeated batches through the institution's normal operational process after selecting its policy. Shared-password audit records identify actions/session access, not individual operators.

## Historical infrastructure, usage and incidents

Apply additive migration `009_analytics_history.sql` before enabling this stage. Set `ANALYTICS_COLLECTION_ENABLED=true` to persist infrastructure history, and independently set `ANALYTICS_USAGE_ENABLED=true` to collect usage. Both default to false. Usage also requires `ANALYTICS_USAGE_SECRET`, a stable 64-character random hex key generated by the setup command. Keep it unchanged across password rotations; changing it splits the pseudonymous account identity used for historical distinct counts. The setup command preserves an existing valid key in the selected environment file.

Set a stable `ANALYTICS_INSTANCE_ID` per API instance (hostname is the fallback), and optionally `ANALYTICS_RELEASE` to the deployed commit/version. Restart the API after changing settings. The History view compares one instance at a time; it never adds duplicated shared-fleet gauges across API replicas. Release markers mean first observed version, not actual deployment time.

The API collector runs independently of dashboard viewers once per minute. It stores at most one infrastructure sample per process boot/minute; request and CPU rates are unknown until a second observation, and reset across boots. A coalesced, eight-second cycle deadline bounds collection. `Collect now` flushes usage and attempts a sample without bypassing minute deduplication. It writes monitoring data only.

Usage events are buffered in bounded memory, then flushed through idempotent absolute counters. The same flush can be retried without doubling counts. A normal shutdown flushes buffered events and releases its fleet-monitoring lease. A crash can lose unflushed activity; pending buckets and dropped-event counters are shown on reports, and these are operational/adoption measurements rather than billing-grade counters. Background collection failure does not fail normal application requests.

Public page views send only a finite coarse route name. The tracker creates no cookie, localStorage entry, visitor ID or fingerprint, omits credentials, and skips the analytics console. Query strings, usernames and dynamic IDs are removed before transmission. The public intake checks the configured origin, requires its custom header, bounds payload size and uses the Redis rate limiter. Page views remain client-reported and may include automated traffic; they are not unique visitors.

Authenticated activity uses a server-side HMAC of the validated account ID and role. Stored usage does not include raw account IDs, names, IPs, tokens, source code or full URLs. Run/Submit counts are recorded only after successful queue admission; they do not mean completed or correct answers. Distinct active accounts include background authenticated requests and are not an online-user count.

The Incidents view persists confirmed conditions and recovery. Two bad observations within consecutive sampling windows open an incident; two good observations resolve it. Unknown data or a gap over 90 seconds resets confirmation streaks and never implies recovery. A PostgreSQL lease elects one fleet detector across API replicas, while process error/delay rules are scoped by instance. The first rules cover unavailable queue telemetry, no healthy workers, queue waits over 30 seconds, schema readiness, and sustained API error/event-loop delay thresholds.

The monitor cannot record an outage while all API processes are stopped or its database is unavailable. History gaps, last persisted time and stale rule observations make this limit visible; an external uptime monitor remains a separate deployment concern. There are no outbound email/chat notifications or automatic runner restarts in this stage.

Monitoring-only retention runs in bounded batches during collection: 30 days for samples/usage and 90 days for resolved incidents. Open incidents and all academic records are preserved. The maintenance command can process additional batches. CSV exports are protected by the analytics session, bounded, audited, and escape spreadsheet formulas; no submission code is exported.

## Verification and next releases

Unit/runtime tests execute the real Fastify analytics plugin with a migrated PostgreSQL-compatible engine. They verify password/session controls, real SQL filters, code access, audit records and isolation from the actual admin middleware. Telemetry tests reject stale/missing/unhealthy/over-capacity records. A dedicated CI job runs migrated PostgreSQL and Redis, the actual API, gateway, production Next.js and Chromium, exercising login/logout, submission inspection, progress, admin separation and mobile/desktop layouts without HTTP interception.

A focused real-Docker CI check verifies idle/occupied/free worker transitions, owned-container visibility and loss of worker readiness. This is not the broader full-stack Docker isolation, recovery or load certification. The console does not introduce destructive runner controls.

The remaining optional work is measured queue/compile/execute/persist timelines, external notifications and hosting-specific resource instrumentation. Academic and operational history survive process restarts after successful persistence. Configuration and migrations must be applied to the actual deployment before collection starts there.
