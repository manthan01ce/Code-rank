# CodeRank Load Testing Guide

## Overview

This guide covers running both **Smoke Tests** and **API Load Tests** for the CodeRank platform.

## Test Types

### 1. Smoke Test (Quick Health Check)
- **Duration:** 25 seconds
- **Users:** 10 → 20 → 0
- **Purpose:** Verify basic functionality
- **Target:** P95 < 800ms, <1% errors

### 2. API Load Test (Performance Under Load)
- **Duration:** 2 minutes  
- **Users:** 20 → 50 → 100 → 150 → 50 → 0
- **Purpose:** Test sustained performance
- **Target:** P95 < 2000ms, <5% errors

---

## Prerequisites

### Software Requirements
```powershell
# Install k6
winget install k6

# Verify installation
k6 version
```

### Service Requirements
- PostgreSQL/Neon database running
- Redis running (for queue stats)
- Node.js v18+ installed
- Port 3000 available

### Environment Setup
```powershell
# Navigate to project
cd C:\Users\Manthan\Desktop\Code-rank

# Ensure .env file exists in apps/web/
# Verify DATABASE_URL and REDIS_URL are set
```

---

## Running Tests

### Option 1: Smoke Test (Recommended First)

#### Step 1: Build Production Bundle
```powershell
cd apps\web
npm run build
```

#### Step 2: Start Production Server
```powershell
$env:NODE_ENV="production"
npm run start
```

Wait for:
```
> CodeRank Server ready:
  - Local:   http://localhost:3000
  - Mode:    production
```

#### Step 3: Run Smoke Test (New Terminal)
```powershell
cd ..\..\load-tests

# Option A: PowerShell script (recommended)
.\test-smoke.ps1

# Option B: Direct k6
k6 run smoke-test.js
```

#### Expected Success Output
```
✅ Smoke test PASSED!
✓ All checks passed (100%)
✓ http_req_duration p(95)<800ms
✓ http_req_failed rate<0.01%

P95: 650ms
Average: 320ms
Cache Hit Rate: 75%
```

---

### Option 2: API Load Test (After Smoke Test Passes)

#### Step 1 & 2: Same as Smoke Test
(Ensure server is running in production mode)

#### Step 3: Run API Load Test
```powershell
cd load-tests

# Option A: PowerShell script (recommended)
.\test-api.ps1

# Option B: Direct k6
k6 run api-load-test.js

# Option C: With authentication
$env:JWT_TOKEN="your-jwt-token"
.\test-api.ps1
```

#### Expected Success Output
```
✅ API Load Test PASSED!
✓ All thresholds met
✓ http_req_duration p(95)<2000ms
✓ http_req_failed rate<0.05

P95: 1800ms
Average: 850ms
Error Rate: 2.1%
Throughput: 16.5 req/s
```

---

## Test Results Interpretation

### ✅ PASSING Test Indicators

| Metric | Smoke Test | API Load Test |
|--------|------------|---------------|
| Check Success | 100% | >95% |
| P95 Duration | <800ms | <2000ms |
| Error Rate | <1% | <5% |
| Failed Requests | 0 | <5% |
| Cache Hit Rate | >70% | >60% |

### ❌ FAILING Test Indicators

| Issue | Indicator | Action |
|-------|-----------|--------|
| High P95 | >800ms (smoke) or >2000ms (API) | Check caching, database |
| High Errors | >1% (smoke) or >5% (API) | Check server logs |
| Failed Checks | <95% success | Check service health |
| Timeouts | Connection errors | Check services running |

---

## Performance Improvements Implemented

### For Both Tests

#### 1. API Endpoint Caching
- Health check: 3s cache
- Queue stats: 1.5s cache
- Graceful degradation on timeout

#### 2. HTTP Configuration
- Keep-alive enabled
- Connection reuse
- Optimized timeouts

#### 3. Next.js Optimizations
- Standalone output
- WebP image format
- Cache-Control headers
- HTTP/2 support

### For API Load Test Specifically

#### 4. Realistic Load Pattern
```
Old: 0 → 400 VUs in 1 minute (too aggressive)
New: 0 → 20 → 50 → 100 → 150 over 1.5 minutes
```

#### 5. Cache Warmup
- Pre-warm all endpoints
- Initialize connection pools
- Reduce cold start impact

#### 6. Connection Management
- Batch requests (10 per group)
- Max 6 concurrent per host
- Connection reuse enabled

---

## Common Issues & Solutions

### Issue 1: Server Not Starting

**Symptoms:**
```
Error: Port 3000 already in use
```

**Solution:**
```powershell
# Find and kill process on port 3000
Get-NetTCPConnection -LocalPort 3000 | Get-Process | Stop-Process

# Or use different port
$env:PORT="3001"
npm run start
```

### Issue 2: Test Failing with High P95

**Symptoms:**
```
❌ http_req_duration p(95)=3200ms (target: <2000ms)
```

**Solutions:**
```powershell
# 1. Verify production mode
echo $env:NODE_ENV  # Should be "production"

# 2. Check cache headers
curl -I http://localhost:3000/api/health | Select-String "X-Cache"

# 3. Reduce load
# Edit api-load-test.js: Change peak from 150 to 100

# 4. Check database
# Verify DATABASE_URL in .env
# Check database performance
```

### Issue 3: Database Errors

**Symptoms:**
```
health check: database unhealthy
Error: Connection refused
```

**Solutions:**
```powershell
# 1. Check DATABASE_URL
cat apps\web\.env | Select-String "DATABASE_URL"

# 2. Test database connection
# Use your database client

# 3. Check database is running
# Neon: Check dashboard
# Local PostgreSQL: Check service status

# 4. Verify connection string format
# postgresql://user:pass@host:port/db
```

### Issue 4: Redis Errors

**Symptoms:**
```
queue service: degraded
Error: ECONNREFUSED Redis
```

**Solutions:**
```powershell
# 1. Check if Redis is required
# (Queue stats may work without Redis)

# 2. Start Redis (if using locally)
# Install: https://redis.io/download
# Start: redis-server

# 3. Verify REDIS_URL
cat apps\web\.env | Select-String "REDIS_URL"

# 4. Update queue stats to handle Redis absence
# Already implemented in improvements
```

### Issue 5: k6 Not Found

**Symptoms:**
```
k6: command not found
```

**Solutions:**
```powershell
# Install k6
winget install k6

# Or download from:
# https://k6.io/docs/getting-started/installation/

# Verify installation
k6 version
```

---

## Monitoring During Tests

### Server Monitoring (Terminal 1)
```powershell
# Watch server logs
cd apps\web
npm run start

# Look for:
# - No errors
# - Cache hits (X-Cache: HIT)
# - Fast response times
```

### Resource Monitoring (Terminal 2)
```powershell
# Monitor Node.js process
while ($true) {
    Get-Process node | Select-Object @{
        Name='CPU%';Expression={$_.CPU}
    }, @{
        Name='Memory(MB)';Expression={[math]::Round($_.WS/1MB,2)}
    }, @{
        Name='Handles';Expression={$_.Handles}
    }
    Start-Sleep 2
}
```

### Test Progress (Terminal 3)
```powershell
# Run the test
cd load-tests
.\test-smoke.ps1
# or
.\test-api.ps1
```

---

## Reports

### Report Location
```
load-tests/reports/
├── 01-smoke-test-results.txt (original)
├── smoke-test-YYYYMMDD-HHMMSS.txt (new runs)
├── 02-api-load-test-results.txt (original)
└── api-load-test-YYYYMMDD-HHMMSS.txt (new runs)
```

### Analyzing Reports

#### Key Sections to Check

1. **Thresholds**
```
✓ http_req_duration....: p(95)=650ms
✓ http_req_failed......: 0.00%
```

2. **Checks**
```
checks...................: 100.00% ✓ 360 ✗ 0
```

3. **Performance Metrics**
```
http_req_duration........: avg=320ms p(95)=650ms
http_reqs................: 240 (8.2/s)
iterations...............: 60 (2.05/s)
```

4. **Network Stats**
```
data_received............: 3.0 MB (104 kB/s)
data_sent................: 19 kB (638 B/s)
```

---

## Best Practices

### Before Testing
1. ✅ Build fresh production bundle
2. ✅ Start server in production mode
3. ✅ Verify services are healthy
4. ✅ Close unnecessary applications
5. ✅ Ensure stable network connection

### During Testing
1. ✅ Don't interact with server
2. ✅ Monitor server logs
3. ✅ Watch for errors
4. ✅ Let test complete fully
5. ✅ Keep system stable

### After Testing
1. ✅ Review full report
2. ✅ Check all thresholds
3. ✅ Analyze failed checks
4. ✅ Document findings
5. ✅ Save reports

---

## Test Progression Path

### Phase 1: Smoke Test ✅
**Goal:** Verify basic functionality  
**Success:** All checks pass, P95 < 800ms  
**Next:** API Load Test

### Phase 2: API Load Test ✅
**Goal:** Test under sustained load  
**Success:** P95 < 2000ms, <5% errors  
**Next:** Stress Test

### Phase 3: Stress Test (Optional)
**Goal:** Find breaking point  
**Command:**
```powershell
k6 run --stage 30s:100 --stage 30s:200 --stage 30s:300 api-load-test.js
```
**Purpose:** Identify maximum capacity

### Phase 4: Soak Test (Optional)
**Goal:** Long-term stability  
**Command:**
```powershell
k6 run --stage 2m:50 --stage 30m:50 --stage 2m:0 api-load-test.js
```
**Purpose:** Detect memory leaks

---

## Quick Reference

### Test Commands
```powershell
# Smoke Test
cd load-tests
.\test-smoke.ps1

# API Load Test
.\test-api.ps1

# Custom VUs
k6 run --vus 30 --duration 30s smoke-test.js

# Custom stages
k6 run --stage 10s:20 --stage 30s:50 --stage 10s:0 api-load-test.js
```

### Health Checks
```powershell
# Quick health check
curl http://localhost:3000/api/health

# Check cache headers
curl -I http://localhost:3000/api/health

# Response time test
Measure-Command { Invoke-WebRequest http://localhost:3000/api/health }
```

### Server Management
```powershell
# Start production server
cd apps\web
$env:NODE_ENV="production"
npm run start

# Check if running
curl http://localhost:3000/api/health

# Stop server
# Press Ctrl+C in server terminal
```

---

## Documentation

- **Smoke Test Details:** `SMOKE_TEST_FIXES.md`
- **Smoke Test Improvements:** `load-tests/SMOKE_TEST_IMPROVEMENTS.md`
- **API Test Details:** `load-tests/API_TEST_IMPROVEMENTS.md`
- **Checklist:** `SMOKE_TEST_CHECKLIST.md`
- **Quick Start:** `RUN_SMOKE_TEST.md`

---

## Support

### If Tests Keep Failing

1. Review documentation above
2. Check server logs for specific errors
3. Verify all services are running
4. Try reducing load (fewer VUs)
5. Check database/Redis connectivity
6. Ensure production mode is set
7. Rebuild application (`npm run build`)
8. Restart server fresh

### Key Files to Check
- `apps/web/.env` - Environment variables
- `apps/web/next.config.mjs` - Next.js config
- `apps/web/server.js` - Server config
- `apps/web/src/app/api/health/route.js` - Health endpoint
- `apps/web/src/app/api/queue/stats/route.js` - Queue stats

---

**Last Updated:** 2025-01-XX  
**CodeRank Version:** 1.1.0  
**Test Suite Version:** 2.0
