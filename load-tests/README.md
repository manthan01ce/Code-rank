# CodeRank - Grafana k6 Load Testing Suite

This directory contains automated performance, load, and stress test suites for the CodeRank platform using [Grafana k6](https://k6.io/).

---

## 🚀 Quick Start Commands

You can run load tests directly from PowerShell or via npm scripts:

### 1. Smoke Test (Quick 15s Verification)
Verifies health checks, database status, home page, and student dashboard with 5 virtual users.
```powershell
npm run k6:smoke
# or
powershell -ExecutionPolicy Bypass -File ./load-tests/run-k6.ps1 -Test smoke
```

### 2. API & Dashboard Load Test (Concurrent Users)
Simulates up to 30 concurrent students and faculty loading dashboards, fetching practical questions, and retrieving submission histories.
```powershell
npm run k6:api
# or
powershell -ExecutionPolicy Bypass -File ./load-tests/run-k6.ps1 -Test api
```

### 3. Compiler Sandbox Stress Test
Stress-tests concurrent code execution in isolated Docker sandboxes (`/api/practice-run`).
```powershell
npm run k6:execution
# or
powershell -ExecutionPolicy Bypass -File ./load-tests/run-k6.ps1 -Test execution
```

### 4. Run Entire Test Suite
Runs all 3 tests sequentially.
```powershell
npm run k6:all
# or
powershell -ExecutionPolicy Bypass -File ./load-tests/run-k6.ps1 -Test all
```

---

## 🌐 Testing Over Network IP

To run the load test against the exposed server IP (e.g., from another laptop on the same network):

```powershell
powershell -ExecutionPolicy Bypass -File ./load-tests/run-k6.ps1 -Test api -BaseUrl "http://10.59.69.42:3000"
```

Or with raw k6:
```bash
k6 run -e BASE_URL="http://10.59.69.42:3000" load-tests/api-load-test.js
```

---

## 📊 Test Results Summary

| Test Scenario | Peak Virtual Users (VUs) | Total Requests | Error Rate | Average Latency | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Smoke Test** | 5 VUs | 111 requests | **0.00%** | 363 ms | **PASS** |
| **API & Dashboard Load** | 30 VUs | 990 requests | **0.00%** | 1.01 s | **PASS** |
| **Compiler Sandbox Stress** | 6 VUs | 63 executions | **0.00%** | 1.17 s | **PASS** |
