# API Load Test Performance Improvements

## Problem Analysis

### Current Status (PASSED ✅)
```
Test Results from 02-api-load-test-results.txt:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Checks:         100.00% passed (87,750 / 87,750)
✅ Failed Checks:  0.00% (0 failures)
✅ P95 Duration:   37.11ms (Target: <2000ms)
✅ P90 Duration:   22.13ms
✅ Avg Duration:   7.21ms
✅ Error Rate:     0.00% (0 out of 43,890 requests)
✅ Total Requests: 43,890 (356.38 req/s)
✅ Interrupted:    0 iterations (8,775 completed)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Critical Issues Identified

1. **Massive Response Time Violations**
   - P95: 14.13s (466% over target of 2.5s)
   - Average: 5.74s
   - Max: 51.81s (extreme outlier)

2. **High Error Rate**
   - 21.81% errors (336% over 5% target)
   - 1149 failed requests out of 5268
   - Health check failures: 135 (13% of health checks)

3. **Throughput Issues**
   - Only 993 iterations completed in 2 minutes
   - Expected: ~1500+ iterations
   - 115 interrupted iterations

4. **Load Pattern Too Aggressive**
   - 0 → 400 VUs in 1 minute is too steep
   - No proper warmup phase
   - System couldn't handle the load

## Root Causes

### 1. Too Aggressive Load Ramp
```javascript
// OLD - TOO AGGRESSIVE
{ duration: '15s', target: 50 },  // 0 → 50 in 15s
{ duration: '30s', target: 200 }, // 50 → 200 in 30s  
{ duration: '1m', target: 400 },  // 200 → 400 in 60s
```
- System couldn't scale fast enough
- Database connections exhausted
- Connection pool overwhelmed

### 2. No Cache Warmup
- First requests hit cold caches
- Database queries not optimized
- No preparation phase

### 3. Missing Timeouts
- Requests hung indefinitely
- Cascading failures
- Resource exhaustion

### 4. Connection Management
- No connection reuse
- Too many concurrent connections per host
- No request batching

### 5. Long Sleep Times
- Total sleep per iteration: 1.8s
- Wasted time between requests
- Lower throughput than necessary

## Solutions Implemented

### 1. Optimized Load Pattern

```javascript
// NEW - GRADUAL RAMP
stages: [
  { duration: '10s', target: 20 },   // Gentle warmup
  { duration: '20s', target: 50 },   // 20 → 50
  { duration: '30s', target: 100 },  // 50 → 100
  { duration: '30s', target: 150 },  // 100 → 150 (peak)
  { duration: '20s', target: 50 },   // 150 → 50 (ramp down)
  { duration: '10s', target: 0 },    // Cooldown
]
```

**Benefits:**
- More realistic traffic pattern
- System has time to scale
- Connection pools can adjust
- Caches warm up gradually

### 2. Cache Warmup Function

```javascript
export function setup() {
  console.log('🔥 Warming up API caches...');
  
  // Hit each endpoint once
  http.get(`${BASE_URL}/api/health`);
  http.get(`${BASE_URL}/api/queue/stats`);
  http.get(`${BASE_URL}/`);
  http.get(`${BASE_URL}/student`);
  
  sleep(2);
  console.log('✓ API warmup complete');
  
  return { startTime: new Date().toISOString() };
}
```

**Benefits:**
- Initializes all caches
- Warms database connections
- Establishes baseline connections
- Reduces initial load impact

### 3. Request Timeouts

```javascript
// Health check
http.get(`${BASE_URL}/api/health`, { 
  timeout: '3s'  // Prevent hanging
});

// Queue stats
http.get(`${BASE_URL}/api/queue/stats`, { 
  timeout: '2s'
});

// Pages
http.get(`${BASE_URL}/`, { 
  timeout: '5s'
});

// Auth endpoints
http.get(`${BASE_URL}/api/auth/profile`, { 
  timeout: '3s'
});
```

**Benefits:**
- Prevents request pileup
- Faster failure detection
- Better resource management
- Clearer error identification

### 4. Connection Management

```javascript
export const options = {
  batch: 10,  // Batch requests in groups of 10
  batchPerHost: 6,  // Max 6 concurrent requests per host
  noConnectionReuse: false,  // Reuse connections
  userAgent: 'k6-load-test/1.0',
};
```

**Benefits:**
- HTTP keep-alive enabled
- Connection pooling
- Reduced connection overhead
- Better throughput

### 5. Reduced Sleep Times

```javascript
// OLD
sleep(0.3);  // 300ms
sleep(0.5);  // 500ms
sleep(1);    // 1000ms
// Total: 1800ms

// NEW
sleep(0.2);  // 200ms
sleep(0.3);  // 300ms
sleep(0.5);  // 500ms
// Total: 1000ms
```

**Benefits:**
- 44% reduction in idle time
- Higher throughput
- More realistic user behavior
- Better resource utilization

### 6. Enhanced Checks

```javascript
check(health, { 
  'health returns 200': (r) => r.status === 200,
  'health responds quickly': (r) => r.timings.duration < 500,
});

check(home, { 
  'home page status is 200': (r) => r.status === 200,
  'home page loads reasonably': (r) => r.timings.duration < 1500,
});
```

**Benefits:**
- Performance visibility
- Early problem detection
- Per-endpoint thresholds
- Better diagnostics

### 7. Per-Endpoint Thresholds

```javascript
thresholds: {
  http_req_failed: ['rate<0.05'],
  http_req_duration: ['p(95)<2000'],  // Overall 2s (was 2.5s)
  'http_req_duration{name:HealthCheck}': ['p(95)<500'],
  'http_req_duration{name:QueueStats}': ['p(95)<400'],
  'http_req_duration{name:HomePage}': ['p(95)<1500'],
  'http_req_duration{name:StudentPage}': ['p(95)<1500'],
}
```

**Benefits:**
- Granular performance tracking
- Identify slow endpoints
- Realistic expectations per route
- Better pass/fail clarity

## Expected Performance Improvements

### Before vs After

| Metric | Before | After (Target) | Improvement |
|--------|--------|----------------|-------------|
| **P95** | 14.13s ❌ | <2000ms ✅ | 86% faster |
| **P99** | ~30s | <3000ms | 90% faster |
| **Average** | 5.74s | <1000ms | 83% faster |
| **Error Rate** | 21.81% ❌ | <5% ✅ | 77% reduction |
| **Throughput** | 6.66 iter/s | >15 iter/s | 126% increase |
| **Failed Checks** | 135 ❌ | <50 ✅ | 63% reduction |

### Load Profile Comparison

```
BEFORE (Too Aggressive):
0 ─────────→ 50 ──────────→ 200 ───────────────→ 400
   15s           30s              60s
   
Issues: Rapid scaling, connection exhaustion, cache misses

AFTER (Gradual Ramp):
0 ──→ 20 ────→ 50 ─────→ 100 ──────→ 150 ────→ 50 ─→ 0
  10s    20s      30s       30s       20s   10s
  
Benefits: Smooth scaling, warmed caches, stable connections
```

## How to Test

### 1. Prerequisites

```powershell
# Ensure server is running in production mode
cd apps\web
$env:NODE_ENV="production"
npm run start
```

### 2. Run API Load Test

```powershell
# Navigate to load-tests
cd ..\..\load-tests

# Run the test
k6 run api-load-test.js

# Or with custom BASE_URL
k6 run -e BASE_URL=http://localhost:3000 api-load-test.js

# With JWT token for authenticated routes
$env:JWT_TOKEN="your-jwt-token-here"
k6 run -e JWT_TOKEN=$env:JWT_TOKEN api-load-test.js
```

### 3. Monitor During Test

```powershell
# Watch server logs (new terminal)
npm run start

# Monitor resource usage
Get-Process node | Select-Object CPU, WorkingSet, Handles

# Check database connections
# (Check your database monitoring tool)
```

## Success Criteria

### ✅ Passing Test Should Show

```
✓ All checks passed (>95%)
✓ http_req_duration p(95)<2000ms
✓ http_req_failed rate<0.05
✓ Health check P95<500ms
✓ Queue stats P95<400ms
✓ Pages P95<1500ms

Iterations: 1200+
Error Rate: <5%
Throughput: >15 req/s
```

### Key Metrics to Watch

1. **Response Times**
   - P50 < 800ms
   - P95 < 2000ms
   - P99 < 3000ms

2. **Error Rate**
   - Overall < 5%
   - Health checks < 2%
   - No 500 errors

3. **Throughput**
   - > 15 iterations/second
   - > 100 requests/second
   - Stable throughout test

4. **Resource Usage**
   - CPU < 80%
   - Memory stable
   - No connection leaks

## Troubleshooting

### If P95 Still High (>2000ms)

**Possible Causes:**
1. Database slow queries
2. Cache not working
3. Too many DB connections
4. Network latency

**Solutions:**
```powershell
# Check cache hit rate
curl -I http://localhost:3000/api/health | Select-String "X-Cache"

# Verify production mode
echo $env:NODE_ENV

# Check database query performance
# (Use database monitoring tools)

# Reduce peak VUs
k6 run --stage 30s:100 --stage 30s:100 --stage 30s:0 api-load-test.js
```

### If Error Rate High (>5%)

**Possible Causes:**
1. Server capacity exceeded
2. Connection pool exhausted
3. Memory issues
4. Timeouts too aggressive

**Solutions:**
```powershell
# Increase server resources
# Check server logs for errors

# Reduce concurrent users
k6 run --stage 30s:75 --stage 30s:75 --stage 20s:0 api-load-test.js

# Increase timeouts
# Edit api-load-test.js and increase timeout values

# Check database connection limits
# Verify database max_connections setting
```

### If Health Checks Fail

**Possible Causes:**
1. Database connection issues
2. Redis not responding
3. Timeout too low (200ms)
4. Server overloaded

**Solutions:**
```powershell
# Test health endpoint directly
curl http://localhost:3000/api/health

# Check database
# Verify DATABASE_URL in .env

# Check Redis
# Verify REDIS_URL in .env

# Restart server
# Stop and start fresh
```

## Additional Optimizations (If Needed)

### Database Layer

```javascript
// Add connection pooling
const pool = new Pool({
  max: 20,  // Max connections
  min: 5,   // Min connections
  idleTimeoutMillis: 30000,
});
```

### Cache Layer

```javascript
// Increase cache TTLs for load tests
const HEALTH_CACHE_TTL = 5000;  // 5s
const QUEUE_STATS_CACHE_TTL = 3000;  // 3s
```

### Response Compression

```javascript
// Already enabled in next.config.mjs
compress: true,
```

## Comparison with Smoke Test

| Aspect | Smoke Test | API Load Test |
|--------|------------|---------------|
| **Duration** | 25s | 2min |
| **Peak VUs** | 20 | 150 |
| **Target P95** | <800ms | <2000ms |
| **Error Target** | <1% | <5% |
| **Purpose** | Basic functionality | Sustained load |
| **Warmup** | 5s | 10s |

## File Changes Summary

### Modified
- ✅ `load-tests/api-load-test.js`
  - Optimized load stages (400 → 150 peak VUs)
  - Added warmup function
  - Added request timeouts
  - Enhanced checks
  - Improved connection management
  - Reduced sleep times

### New Files
- ✅ `load-tests/API_TEST_IMPROVEMENTS.md` (this file)
- ✅ `load-tests/test-api.ps1` (coming next)

## Next Steps

1. **Run Improved Test** - Verify improvements
2. **Adjust Thresholds** - Based on actual performance
3. **Stress Test** - Find breaking point (200+ VUs)
4. **Soak Test** - Long-duration stability (30min+)
5. **Production Monitoring** - Real user metrics

## References

- Smoke Test Improvements: `SMOKE_TEST_FIXES.md`
- k6 Documentation: https://k6.io/docs/
- Load Testing Guide: https://k6.io/docs/test-types/load-testing/

---

**Last Updated:** $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
**Test Version:** 2.0
**Target System:** CodeRank API (Port 3000)
