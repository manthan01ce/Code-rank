# Performance qualification

Use qualification.js for strict smoke, API, run, submission and 200-user concurrency tests. Older submission tests accept some 401 responses as passing checks and do not wait for final submission grading.

## Setup

Start the web service, Redis, database, worker and rebuilt runner containers. A frontend alone cannot execute Docker jobs. Rebuild runner/Dockerfile to install GNU time. Keep authentication and rate limits enabled.

Create load-tests/students.local.json (ignored by Git), containing one fixture per VU:

```json
[{"token":"REPLACE_WITH_STUDENT_JWT","practicalId":1,"language":"python","code":"print(input())","expectedStatus":"accepted"}]
```

The example code only works for an echo practical. Supply known-correct solutions and 200 distinct student accounts/tokens assigned to active practicals with public and hidden cases and valid batch/semester. A single shared account distorts throttling and persistence. Use a test cohort: submissions create real attempts and best-score records. Keep fixtures out of Git and reports.

## Execution

Run from the repository root, gating larger tests on smoke:

```bash
k6 run -e BASE_URL=https://YOUR-TARGET -e MODE=smoke load-tests/qualification.js
k6 run -e BASE_URL=https://YOUR-TARGET -e MODE=api -e VUS=200 load-tests/qualification.js
k6 run -e BASE_URL=https://YOUR-TARGET -e MODE=run -e VUS=200 load-tests/qualification.js
k6 run -e BASE_URL=https://YOUR-TARGET -e MODE=submission -e VUS=200 load-tests/qualification.js
k6 run -e BASE_URL=https://YOUR-TARGET -e MODE=concurrency -e VUS=200 load-tests/qualification.js
```

Smoke runs samples and submits with one user. API tests authenticated practical-list reads. API/run/submission profiles ramp through 20/50/100/200 users and hold 200 for two minutes. Run checks sample outcomes; submission checks grading and persistence with a 15-second think time. Concurrency starts 200 VUs, one submission each, and waits for final results. This is 200 clients, not 200 worker slots; default worker concurrency remains 8.

Each command exits nonzero on threshold failure and writes qualification-MODE-summary.json. For Grafana Cloud, use the same script with k6 cloud run after configuring your project and authentication. No Cloud credentials were available here.

## Proposed gates

All functional checks pass; flow success >99%; HTTP failures <1%; no dropped iterations. Read/enqueue p95 <1 second; turnaround p95 <15 seconds and p99 <30 seconds; per-job deadline 60 seconds. Burst requires at least 200 accepted and 200 completed jobs. Unauthorized responses, missing jobs, throttles, rejected queues, wrong verdicts, missing submission IDs and timeouts fail.

Queue wait, worker duration and client turnaround are separate metrics. Capture server CPU/RSS, queue depth, Redis latency, DB connections/latency and runner CPU/RSS alongside k6. These gates are proposed, not measured baselines. Do not blindly raise worker concurrency to 200: each language daemon shares a 1-CPU/512-MiB container.

Sample runs and final submissions both require accepted and every case passing. Sample-run verdicts now depend on case outcomes independently of grading marks.

## Current status, 2026-10-20

Installed k6 v1.3.0 and inspected all five profiles, including the 200-VU burst. Live smoke preflight against https://code-rank-two.vercel.app failed with Execution target unavailable. A direct request returned HTTP 404 and x-vercel-error: DEPLOYMENT_NOT_FOUND. No authenticated or 200-user workload ran. Dummy inspection fixtures were removed. A reachable environment and 200 valid student fixtures are required to finish.
