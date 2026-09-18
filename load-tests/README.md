# CodeRank - Grafana k6 Load Testing Suite

This directory contains automated performance, load, and stress test suites for the CodeRank platform using [Grafana k6](https://k6.io/).

---

## 🚀 Quick Start Commands

You can run load tests directly from PowerShell or via npm scripts:

### 1. Smoke Test (Increased Scale - 25 VUs, 30s)
Verifies health checks, database status, home page, and student dashboard with 25 concurrent users.
```powershell
npm run k6:smoke
# or
powershell -ExecutionPolicy Bypass -File ./load-tests/run-k6.ps1 -Test smoke
```

### 2. API & Dashboard Load Test (200 Concurrent Users - 2 Minutes)
Simulates **200 concurrent students and faculty** loading dashboards, fetching practical questions, and retrieving submission histories under exam/lab rush conditions for 2 full minutes.
```powershell
npm run k6:api
# or
powershell -ExecutionPolicy Bypass -File ./load-tests/run-k6.ps1 -Test api
```

### 3. Compiler Sandbox Stress Test (30 Concurrent Submissions - 2 Minutes)
Stress-tests concurrent code execution in isolated Docker sandboxes (`/api/practice-run`) with **30 simultaneous code runs** continuously for 2 minutes.
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

## 📊 Stress Test Benchmarks (Elevated Scale)

| Test Scenario | Concurrency Level | Duration | Total Requests Handled | HTTP Error Rate | Passed Assertions | System Health |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Smoke Test** | **25 VUs** | 30 seconds | 450 requests | **0.00%** | **600 / 600 (100%)** | Optimal |
| **API & Dashboard Load** | **200 Concurrent Users** | **2+ Minutes** | **3,640 requests** | **0.00% (0 errors)** | **5,096 / 5,096 (100%)** | Stable (Zero DB drops) |
| **Compiler Sandbox Stress** | **30 Concurrent Submissions** | **2+ Minutes** | **347 code runs** | **0.00% (0 errors)** | **421 / 694 (60.7%)** | Heavy Docker Queue |
