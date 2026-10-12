# 🚀 CodeRank — Grafana k6 Load & Stress Testing Suite

Comprehensive performance testing suite for **CodeRank's** Next.js + Socket.IO + BullMQ architecture.
Built with [Grafana k6](https://k6.io/) — no browser, pure protocol-level load generation.

---

## 📊 Test Suite Overview

| # | Script | Mode | Peak Load | Duration | Purpose |
|---|--------|------|-----------|----------|---------|
| 1 | `smoke-test.js` | Sanity | 20 VUs | 20s | DB + Queue + Gateway readiness check |
| 2 | `api-load-test.js` | Load | 400 VUs | ~2m | API latency & throughput under peak traffic |
| 3 | `execution-stress-test.js` | Stress | 150 VUs | ~2m | BullMQ queue, worker concurrency, Docker execution |
| 4 | `websocket-polling-test.js` | Load | 300 VUs | ~2.5m | Socket.IO handshake + real-time polling throughput |
| 5 | `rate-limit-test.js` | Validation | 150 VUs | ~2m | Confirms 429s fire correctly (keep rate limiting ON) |
| 6 | `submission-load-test.js` | Scenario | 120 student VUs + 5 faculty VUs | ~2.5m | Full lab session: submit → execute → poll → faculty view |
| 7 | `max-users-test.js` | Soak/Break | up to 1000 req/s | ~5.5m | Server break point — **disable rate limit & cache before running** |

---

## 🛠️ Prerequisites

### 1. Install Grafana k6

```powershell
# Windows — choose one:
winget install k6
choco install k6
scoop install k6
```

### 2. Start CodeRank services

```powershell
# Infrastructure (Postgres + Redis)
docker compose -f infrastructure/docker-compose.yml up -d

# Web server (Next.js + Socket.IO)
npm run web       # or: node apps/web/server.js

# Code execution worker
npm run worker
```

### 3. Get a JWT token (for authenticated tests)

Log in through the UI and grab the token from DevTools → Application → Local Storage,
or use the login API:

```powershell
$res = Invoke-RestMethod -Method POST -Uri "http://localhost:3000/api/auth/login" `
    -ContentType "application/json" `
    -Body '{"username":"student1","password":"yourpass"}'
$studentToken = $res.token
```

---

## ⚡ Quick Start

```powershell
# 1. Quick sanity check (always run first)
.\load-tests\run-k6.ps1 -Test smoke

# 2. API load test
.\load-tests\run-k6.ps1 -Test api -BaseUrl "http://localhost:3000"

# 3. WebSocket + polling load
.\load-tests\run-k6.ps1 -Test websocket -BaseUrl "http://localhost:3000" -JwtToken "your_token"

# 4. Full lab simulation (student submissions + faculty monitoring)
.\load-tests\run-k6.ps1 -Test submission `
    -JwtToken "student_jwt_here" `
    -FacultyToken "faculty_jwt_here" `
    -PracticalId "1" `
    -CourseId "1"

# 5. Rate limit validation (keep rate limiting ON for this one)
.\load-tests\run-k6.ps1 -Test ratelimit

# 6. Run all non-destructive tests sequentially
.\load-tests\run-k6.ps1 -Test all -JwtToken "your_token" -FacultyToken "faculty_token"
```

---

## 💥 Maximum Capacity Test

> ⚠️ **READ CAREFULLY BEFORE RUNNING**
>
> The `max-users-test.js` is designed to **crash or saturate the server**.
> It ramps from 10 req/s up to **1000 req/s** in stages to find the exact break point.

### Step 1 — Disable rate limiting & cache

Add to `apps/web/.env` (or root `.env`):
```env
DISABLE_RATE_LIMIT=true
DISABLE_CACHE=true
```
Restart the server after changing `.env`.

### Step 2 — Run the test

```powershell
.\load-tests\run-k6.ps1 -Test max `
    -BaseUrl "http://localhost:3000" `
    -JwtToken "your_token" `
    -DisableRateLimit `
    -DisableCache
```

Or directly with k6:
```bash
k6 run \
  -e BASE_URL=http://localhost:3000 \
  -e JWT_TOKEN=your_token \
  -e DISABLE_RATE_LIMIT=true \
  -e DISABLE_CACHE=true \
  load-tests/max-users-test.js
```

### Step 3 — Restore rate limiting after test

```env
# Remove or set back in .env:
DISABLE_RATE_LIMIT=false
DISABLE_CACHE=false
```

### What to look for in the output

| Metric | Meaning |
|--------|---------|
| `http_req_failed` rate spikes | Server started dropping requests |
| `server_break_errors_5xx` counter | Server-side crashes / unhandled errors |
| `db_pool_exhausted_signals` counter | Database connection pool is too small |
| `timeout_errors` counter | Requests hanging longer than 15s |
| `response_p99_trend` | Response time degradation curve over time |
| `health check reachable` fails | Server completely overwhelmed |

---

## 🔒 Rate Limit Test

```powershell
# Keep rate limiting ENABLED for this test
.\load-tests\run-k6.ps1 -Test ratelimit -BaseUrl "http://localhost:3000"
```

This test:
- Sends **30 login requests/sec** (brute-force simulation)
- Sends **20 execution requests/sec** (execution abuse simulation)
- Sends **25 submission requests/sec** (submission spam simulation)
- Verifies all `429 Too Many Requests` responses contain `Retry-After` header

**Expected outcome**: High 429 rate = rate limiting is working correctly ✅

---

## 🌐 WebSocket & Polling Test

```powershell
.\load-tests\run-k6.ps1 -Test websocket `
    -JwtToken "your_token" `
    -PracticalId "1" `
    -CourseId "1"
```

Tests:
- Socket.IO polling transport handshake (`/socket.io/?EIO=4&transport=polling`)
- `GET /api/student/practicals` polling throughput
- `GET /api/student/submissions` polling throughput
- `GET /api/faculty/practicals/:id/submissions` polling throughput
- `GET /api/faculty/courses/:id/stats` polling throughput
- `GET /api/jobs/:jobId` job status polling

---

## 📁 Running via k6 CLI Directly

```bash
# Smoke
k6 run -e BASE_URL=http://localhost:3000 load-tests/smoke-test.js

# API Load
k6 run -e BASE_URL=http://localhost:3000 -e JWT_TOKEN=token load-tests/api-load-test.js

# Execution Stress
k6 run -e BASE_URL=http://localhost:3000 load-tests/execution-stress-test.js

# WebSocket + Polling
k6 run -e BASE_URL=http://localhost:3000 -e JWT_TOKEN=token load-tests/websocket-polling-test.js

# Rate Limit Validation
k6 run -e BASE_URL=http://localhost:3000 load-tests/rate-limit-test.js

# Submission Load (full lab session)
k6 run \
  -e BASE_URL=http://localhost:3000 \
  -e JWT_TOKEN=student_token \
  -e FACULTY_TOKEN=faculty_token \
  -e PRACTICAL_ID=1 \
  -e COURSE_ID=1 \
  load-tests/submission-load-test.js

# Max Capacity (disable rate limit first!)
k6 run \
  -e BASE_URL=http://localhost:3000 \
  -e JWT_TOKEN=token \
  -e DISABLE_RATE_LIMIT=true \
  load-tests/max-users-test.js
```

---

## 📈 Key Performance Thresholds

| Metric | Target |
|--------|--------|
| `http_req_failed` (API/smoke) | `< 1–5%` |
| `http_req_duration p(95)` (API) | `< 2.5s` |
| `http_req_duration p(95)` (WebSocket polling) | `< 3s` |
| `poll_success_rate` | `> 90%` |
| `socket_handshake_duration p(95)` | `< 2s` |
| `execution_success_rate` (submission test) | `> 85%` |
| `workspace_save_rate` | `> 90%` |
| `submission_latency p(90)` | `< 3s` |
| `job_completion_time p(75)` | `< 15s` |

---

## 🗒️ Test Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:3000` | Target server URL |
| `JWT_TOKEN` | `` | Student JWT bearer token |
| `FACULTY_TOKEN` | `` | Faculty JWT bearer token |
| `PRACTICAL_ID` | `1` | Practical ID to test against |
| `COURSE_ID` | `1` | Course ID to test against |
| `JOB_ID` | `` | Optional pre-known job ID for polling tests |
| `DISABLE_RATE_LIMIT` | `false` | Signal to server: disable rate limiting |
| `DISABLE_CACHE` | `false` | Signal to server: disable caching |

> **Note**: `DISABLE_RATE_LIMIT` and `DISABLE_CACHE` are env vars passed to k6.
> Your server must read and honour them (check your middleware config).
