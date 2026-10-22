# Quick Start - Run Smoke Test

## Prerequisites

1. **Install k6** (if not already installed)
```powershell
winget install k6
```

2. **Ensure all services are running**
- Database (PostgreSQL/Neon)
- Redis
- BullMQ worker (optional for full test)

## Step-by-Step Instructions

### 1️⃣ Build the Application

```powershell
cd apps\web
npm run build
```

Wait for build to complete (should take 1-2 minutes).

### 2️⃣ Start Production Server

```powershell
# Set environment to production
$env:NODE_ENV="production"

# Start the server
npm run start
```

Wait for:
```
> CodeRank Server ready:
  - Local:   http://localhost:3000
  - Network: http://0.0.0.0:3000
  - Mode:    production
```

### 3️⃣ Run Smoke Test (in a new terminal)

```powershell
# Navigate to load-tests directory
cd load-tests

# Option A: Run with PowerShell script (recommended)
.\test-smoke.ps1

# Option B: Run k6 directly
k6 run smoke-test.js
```

## What to Expect

### ✅ Success Output

```
✓ All checks passed
✓ http_req_duration p(95)<800ms
✓ http_req_failed rate<0.01%

✅ Smoke test PASSED!
```

### ❌ Failure Output

```
✗ http_req_duration p(95)=1.2s (target: <800ms)
✓ http_req_failed rate=0.00%

❌ Smoke test FAILED!
```

## Interpreting Results

### Key Metrics

| Metric | Target | What it means |
|--------|--------|---------------|
| **P95 Duration** | <800ms | 95% of requests finish in under 800ms |
| **Failed Requests** | <1% | Less than 1% of requests fail |
| **Checks Passed** | 100% | All health/status checks succeed |
| **Cache Hit Rate** | >70% | Caching is working effectively |

### Sample Good Result

```
checks........................: 100.00% ✓ 360  ✗ 0
http_req_duration.............: avg=320ms p(95)=650ms
http_req_failed...............: 0.00%   ✓ 0    ✗ 240
iterations....................: 60

✅ All thresholds met!
```

### Sample Bad Result

```
checks........................: 95.00%  ✓ 342  ✗ 18
http_req_duration.............: avg=1.2s p(95)=2.1s
http_req_failed...............: 0.00%   ✓ 0    ✗ 240

❌ Threshold violated: p(95) should be < 800ms
```

## Troubleshooting

### Issue: Server not running

**Error:** `Connection refused` or `ECONNREFUSED`

**Fix:**
```powershell
# Start the server
cd apps\web
npm run start
```

### Issue: k6 not found

**Error:** `k6: command not found`

**Fix:**
```powershell
# Install k6
winget install k6

# Or download from: https://k6.io/docs/getting-started/installation/
```

### Issue: High response times

**Error:** P95 > 800ms

**Possible causes:**
1. Database connection slow
2. Redis not running
3. Server not in production mode
4. Cold start (run test again)

**Fix:**
```powershell
# Check environment
echo $env:NODE_ENV  # Should output "production"

# Restart server
# Stop current server (Ctrl+C)
$env:NODE_ENV="production"
npm run start

# Wait 10 seconds for warmup
Start-Sleep -Seconds 10

# Run test again
cd ..\..\load-tests
.\test-smoke.ps1
```

### Issue: Database errors

**Error:** Health check fails with database unhealthy

**Fix:**
```powershell
# Check .env file
cat apps\web\.env | Select-String "DATABASE_URL"

# Verify database is accessible
# Test connection manually or check logs
```

### Issue: Cache not working

**Error:** All requests show X-Cache: MISS

**Fix:**
```powershell
# Check if running in production mode
echo $env:NODE_ENV

# Verify cache headers in response
curl -I http://localhost:3000/api/health

# Should show Cache-Control header
```

## Quick Commands Reference

### Check Server Status
```powershell
# Test health endpoint
curl http://localhost:3000/api/health

# Check response time
Measure-Command { Invoke-WebRequest http://localhost:3000/api/health }
```

### Check Cache Headers
```powershell
# View all headers
curl -I http://localhost:3000/api/health

# Should include:
# X-Cache: HIT or MISS
# Cache-Control: public, s-maxage=3, stale-while-revalidate=5
```

### Run Specific Test Groups
```powershell
# Run only health checks
k6 run --stage 10s:10 smoke-test.js

# Run with custom duration
k6 run --duration 30s smoke-test.js

# Run with more users
k6 run --vus 30 --duration 20s smoke-test.js
```

## Performance Targets

### Smoke Test (Current)
- VUs: 10 → 20 → 0
- Duration: 25s
- Target P95: <800ms
- Target Error Rate: <1%

### Load Test (Next)
- VUs: 50-100
- Duration: 5min
- Target P95: <1200ms

### Stress Test (Future)
- VUs: 200+
- Duration: 10min
- Find breaking point

## Files Modified

All smoke test improvements are in:

1. **API Routes**
   - `apps/web/src/app/api/health/route.js`
   - `apps/web/src/app/api/queue/stats/route.js`

2. **Configuration**
   - `apps/web/next.config.mjs`
   - `apps/web/server.js`

3. **Test Files**
   - `load-tests/smoke-test.js`
   - `load-tests/test-smoke.ps1` (new)

4. **Documentation**
   - `SMOKE_TEST_FIXES.md`
   - `load-tests/SMOKE_TEST_IMPROVEMENTS.md`

## Success Checklist

Before running the test:
- [ ] Built production bundle (`npm run build`)
- [ ] Started server in production mode
- [ ] Server shows "ready" message
- [ ] Database is connected
- [ ] Redis is running (if using queue stats)

During the test:
- [ ] Test completes without errors
- [ ] All checks pass (100%)
- [ ] P95 < 800ms
- [ ] Error rate < 1%

After the test:
- [ ] Review detailed metrics
- [ ] Check cache hit rate
- [ ] Verify response times
- [ ] Document results

## Next Steps

After smoke test passes:

1. **Review Results** - Analyze detailed metrics
2. **Load Test** - Run with higher concurrency
3. **Stress Test** - Find system limits
4. **Optimize Further** - Based on findings
5. **Production Monitoring** - Set up alerts

## Need Help?

1. Check `SMOKE_TEST_FIXES.md` for detailed explanations
2. Review `load-tests/SMOKE_TEST_IMPROVEMENTS.md` for troubleshooting
3. Check server logs for errors
4. Verify all prerequisites are met

---

**Ready to test?** Run: `.\test-smoke.ps1` 🚀
