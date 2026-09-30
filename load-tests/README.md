# 🚀 CodeRank v1.1 — Grafana k6 Load & Stress Testing Suite

Comprehensive load, stress, and performance testing suite built for **CodeRank's Modular Monorepo Architecture** using [Grafana k6](https://k6.io/).

---

## 📊 Test Suite Overview

| Test Script | Target | Concurrent Load | Purpose |
|---|---|---|---|
| `smoke-test.js` | `/api/health`, `/`, `/login` | 20 VUs (20s) | Instant sanity check verifying DB, Queue, and Gateway readiness |
| `api-load-test.js` | API Gateway, Student endpoints, Profile, Practicals | 50 – 400 VUs (2m) | Measures API latency and throughput under peak concurrent web traffic |
| `execution-stress-test.js` | Async Execution Pipeline (`/api/execute` & `/api/jobs/{id}`) | 20 – 150 VUs (2m) | Stresses BullMQ queue dispatch, worker concurrency, and Docker daemons |

---

## 🛠️ Prerequisites

1. **Install Grafana k6**:
   ```powershell
   # Windows (winget)
   winget install k6

   # Or via Chocolatey
   choco install k6
   ```

2. **Start CodeRank services**:
   ```bash
   # Start Redis + Postgres
   docker compose -f infrastructure/docker-compose.yml up -d

   # Start Web gateway
   npm run web

   # Start Execution worker
   npm run worker
   ```

---

## ⚡ Running Tests

### Option A: Using PowerShell Runner Script

```powershell
# Run Quick Smoke Test
.\load-tests\run-k6.ps1 -Test smoke

# Run Full API Load Test against custom URL
.\load-tests\run-k6.ps1 -Test api -BaseUrl "http://localhost:3000"

# Run Execution Engine Stress Test with Auth Token
.\load-tests\run-k6.ps1 -Test execution -JwtToken "YOUR_STUDENT_JWT_TOKEN"

# Run All Tests sequentially
.\load-tests\run-k6.ps1 -Test all
```

### Option B: Running Directly with k6 CLI

```bash
# Smoke test
k6 run -e BASE_URL=http://localhost:3000 load-tests/smoke-test.js

# API Load test
k6 run -e BASE_URL=http://localhost:3000 -e JWT_TOKEN=your_token load-tests/api-load-test.js

# Execution Engine Stress test
k6 run -e BASE_URL=http://localhost:3000 load-tests/execution-stress-test.js
```

---

## 📈 Key Performance Indicators & Thresholds

- **API Request Failure Rate (`http_req_failed`)**: `< 5%` under sustained 400 VU peak load.
- **P95 Latency (`http_req_duration`)**: `< 800ms` for static/cached pages, `< 2.5s` for heavy DB queries.
- **Execution Queue Ingestion**: 202 Accepted status within `< 500ms`, job completion within `< 10s`.
