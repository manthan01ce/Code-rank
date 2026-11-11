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

Worker telemetry is sampled about every 10 seconds and becomes stale after 30 seconds. Stale records are retained briefly so the console can show a lost heartbeat. The dashboard polls a shared, coalesced API-process snapshot every five seconds and pauses network polling in hidden tabs. Its pause button stops automatic overview polling. Each panel shows snapshot time; monitoring is sampled rather than an atomic fleet-wide view.

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

## Verification and next releases

Unit/runtime tests execute the real Fastify analytics plugin with a migrated PostgreSQL-compatible engine. They verify password/session controls, real SQL filters, code access, audit records and isolation from the actual admin middleware. Telemetry tests reject stale/missing/unhealthy/over-capacity records. A dedicated CI job runs migrated PostgreSQL and Redis, the actual API, gateway, production Next.js and Chromium, exercising login/logout, submission inspection, progress, admin separation and mobile/desktop layouts without HTTP interception.

This first release does not claim full Docker execution certification: positive worker capacity under real executions remains part of full-stack Docker validation. It also does not introduce destructive runner controls.

The following agreed stages remain separate: durable operational time-series, activity events for Run/visitor usage, measured queue/compile/execute/persist timelines, persisted incidents, external notifications, deployment markers and exports. Academic trends already survive restarts because they are calculated from existing durable records. Configuration must be applied to the actual deployment before the dashboard can be unlocked there.
