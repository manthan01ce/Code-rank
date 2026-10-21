# ✅ Smoke Test Pre-Flight Checklist

## Prerequisites Check

### Software Requirements
- [ ] Node.js installed (v18+)
- [ ] k6 installed (`winget install k6`)
- [ ] PowerShell available
- [ ] Git (for version control)

### Services Status
- [ ] PostgreSQL/Neon database running
- [ ] Redis running (optional, for queue stats)
- [ ] Network connectivity verified
- [ ] Port 3000 available

### Environment Setup
- [ ] `.env` file exists in `apps/web/`
- [ ] `DATABASE_URL` configured
- [ ] `REDIS_URL` configured (if using)
- [ ] `JWT_SECRET` set
- [ ] All required environment variables present

---

## Pre-Test Setup

### 1. Code Changes Verification
- [ ] `apps/web/src/app/api/health/route.js` - Updated
- [ ] `apps/web/src/app/api/queue/stats/route.js` - Updated
- [ ] `apps/web/next.config.mjs` - Updated
- [ ] `apps/web/server.js` - Updated
- [ ] `load-tests/smoke-test.js` - Updated

### 2. Build Process
```powershell
cd apps\web
```
- [ ] Run `npm install` (if needed)
- [ ] Run `npm run build`
- [ ] Build completes without errors
- [ ] `.next` folder created
- [ ] No TypeScript errors
- [ ] No ESLint errors

### 3. Server Startup
```powershell
$env:NODE_ENV="production"
npm run start
```
- [ ] Server starts successfully
- [ ] No startup errors in console
- [ ] "CodeRank Server ready" message appears
- [ ] Port 3000 is listening
- [ ] Socket.IO initializes correctly

### 4. Quick Health Check
```powershell
curl http://localhost:3000/api/health
```
- [ ] Returns 200 status
- [ ] Response includes `database` status
- [ ] Response includes `queue` status
- [ ] Response time < 500ms
- [ ] JSON format is valid

---

## Test Execution

### Pre-Test Validation
```powershell
cd load-tests
```
- [ ] `smoke-test.js` file exists
- [ ] `test-smoke.ps1` file exists (optional)
- [ ] File paths are correct
- [ ] BASE_URL is set correctly (localhost:3000)

### Running the Test

#### Option A: Using PowerShell Script
```powershell
.\test-smoke.ps1
```
- [ ] Script executes without errors
- [ ] k6 is found
- [ ] Server connectivity verified
- [ ] Test starts and runs

#### Option B: Direct k6
```powershell
k6 run smoke-test.js
```
- [ ] Test initialization succeeds
- [ ] Warmup phase completes (5s)
- [ ] Load phase runs (15s)
- [ ] Ramp down completes (5s)
- [ ] Test finishes gracefully

---

## Results Validation

### During Test Execution
- [ ] VUs ramp up correctly (0 → 10 → 20 → 0)
- [ ] No connection errors
- [ ] Requests are being sent
- [ ] Responses are received
- [ ] No timeout errors
- [ ] Progress shows continuously

### Metrics to Check

#### ✅ Success Criteria
- [ ] **Checks Passed**: 100% (all green ✓)
- [ ] **P95 Duration**: < 800ms
- [ ] **Error Rate**: < 1%
- [ ] **HTTP Failed**: 0% or near 0%
- [ ] **Iterations**: Completes 60+
- [ ] **Cache Hits**: Visible in logs

#### 📊 Performance Metrics
- [ ] `http_req_duration` avg < 400ms
- [ ] `http_req_duration` p(50) < 200ms
- [ ] `http_req_duration` p(95) < 800ms
- [ ] `http_req_duration` p(99) < 1200ms
- [ ] `http_req_failed` rate < 0.01

#### 🔍 Endpoint-Specific Checks
- [ ] Health check: `p(95) < 500ms`
- [ ] Landing page: `p(95) < 1000ms`
- [ ] Login page: `p(95) < 1000ms`
- [ ] Queue stats: `p(95) < 300ms`

### k6 Output Analysis
```
Expected Output Pattern:
━━━━━━━━━━━━━━━━━━━━━━━
✓ health status is 200
✓ health response < 500ms
✓ database is healthy
✓ queue service responded
✓ landing page status is 200
✓ landing page loads < 1s
✓ login page status is 200
✓ login page loads < 1s
✓ queue stats status is 200 or 503
✓ queue stats response < 300ms
```

- [ ] All checks show ✓ (green)
- [ ] No checks show ✗ (red)
- [ ] Threshold summary shows passing
- [ ] No warnings or errors

---

## Post-Test Verification

### Server Health
```powershell
# Check health endpoint
curl http://localhost:3000/api/health

# Check for cache headers
curl -I http://localhost:3000/api/health | Select-String "X-Cache"
```
- [ ] Server still responsive
- [ ] No memory leaks visible
- [ ] Cache headers present
- [ ] X-Cache shows HIT on subsequent requests

### Cache Verification
```powershell
# First request
curl -I http://localhost:3000/api/health
# Should show: X-Cache: MISS

# Second request (within 3 seconds)
curl -I http://localhost:3000/api/health  
# Should show: X-Cache: HIT
```
- [ ] First request: `X-Cache: MISS`
- [ ] Second request: `X-Cache: HIT`
- [ ] Cache-Control header present
- [ ] TTL values correct

### Response Time Check
```powershell
Measure-Command { 
  Invoke-WebRequest http://localhost:3000/api/health 
} | Select-Object TotalMilliseconds
```
- [ ] First request: ~100-300ms
- [ ] Cached request: <10ms
- [ ] Consistent response times
- [ ] No outliers or spikes

---

## Troubleshooting Steps

### If Test Fails

#### Check 1: Server Mode
```powershell
# Verify production mode
echo $env:NODE_ENV
# Should output: production
```
- [ ] Production mode confirmed
- [ ] If not, restart server with correct env

#### Check 2: Cache Functionality
```powershell
curl -I http://localhost:3000/api/health
```
- [ ] Cache-Control header exists
- [ ] X-Cache header exists
- [ ] Values match configuration

#### Check 3: Database Connection
```powershell
# Check .env
cat apps\web\.env | Select-String "DATABASE_URL"
```
- [ ] DATABASE_URL present
- [ ] Connection string valid
- [ ] Database accessible

#### Check 4: Build Status
```powershell
# Check if .next exists
Test-Path apps\web\.next
# Should return: True
```
- [ ] `.next` folder exists
- [ ] Build is recent (check timestamp)
- [ ] No stale builds

#### Check 5: Port Availability
```powershell
# Check if port 3000 is in use
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
```
- [ ] Port 3000 shows LISTENING
- [ ] Only one process on port
- [ ] No conflicts

---

## Common Issues & Solutions

### Issue: High P95 Times
**Symptoms:** P95 > 800ms but checks pass

**Solutions:**
1. [ ] Wait 30s for caches to warm up
2. [ ] Run test again
3. [ ] Check database query performance
4. [ ] Verify Redis is running
5. [ ] Check system resources (CPU/Memory)

### Issue: Failed Checks
**Symptoms:** Red ✗ marks in output

**Solutions:**
1. [ ] Check server logs for errors
2. [ ] Verify all services running
3. [ ] Check DATABASE_URL
4. [ ] Verify Redis connection
5. [ ] Check for runtime errors

### Issue: Connection Errors
**Symptoms:** ECONNREFUSED or timeout errors

**Solutions:**
1. [ ] Verify server is running
2. [ ] Check port 3000 availability
3. [ ] Test with `curl localhost:3000`
4. [ ] Check firewall settings
5. [ ] Verify hostname/port in test

### Issue: Cache Not Working
**Symptoms:** All X-Cache: MISS

**Solutions:**
1. [ ] Restart server
2. [ ] Clear .next cache
3. [ ] Rebuild application
4. [ ] Verify production mode
5. [ ] Check next.config.mjs headers

---

## Final Validation

### ✅ All Systems Go
- [ ] Test completed successfully
- [ ] All thresholds passed
- [ ] 100% checks passed
- [ ] P95 < 800ms
- [ ] Error rate < 1%
- [ ] Cache hit rate > 70%
- [ ] No errors in server logs
- [ ] Server remains stable

### 📄 Documentation
- [ ] Results saved/documented
- [ ] Screenshots taken (if needed)
- [ ] Metrics recorded
- [ ] Issues noted (if any)

### 🚀 Ready for Next Stage
- [ ] Smoke test baseline established
- [ ] Performance targets met
- [ ] Ready for load testing
- [ ] Ready for stress testing
- [ ] Can proceed to production

---

## Quick Commands Reference

### Test Execution
```powershell
# Full test
.\test-smoke.ps1

# Direct k6
k6 run smoke-test.js

# With custom VUs
k6 run --vus 30 smoke-test.js

# Longer duration
k6 run --duration 60s smoke-test.js
```

### Health Checks
```powershell
# Basic health
curl http://localhost:3000/api/health

# With headers
curl -I http://localhost:3000/api/health

# Response time
Measure-Command { Invoke-WebRequest http://localhost:3000/api/health }

# Watch cache
while($true) { curl -I http://localhost:3000/api/health | Select-String "X-Cache"; Start-Sleep 1 }
```

### Server Management
```powershell
# Start server
$env:NODE_ENV="production"; npm run start

# Check process
Get-Process -Name node

# Stop server (Ctrl+C or)
Stop-Process -Name node
```

---

## Sign-Off

### Test Completed By
- Name: _________________
- Date: _________________
- Time: _________________

### Results
- [ ] ✅ PASSED - All criteria met
- [ ] ⚠️ PASSED WITH WARNINGS - Minor issues
- [ ] ❌ FAILED - Requires fixes

### Notes
```
_________________________________________
_________________________________________
_________________________________________
```

### Next Actions
- [ ] Document results
- [ ] Update team
- [ ] Schedule load test
- [ ] Deploy to staging
- [ ] Monitor production

---

**Test Version:** 1.0  
**Last Updated:** 2025-01-XX  
**Target Environment:** Local Development
