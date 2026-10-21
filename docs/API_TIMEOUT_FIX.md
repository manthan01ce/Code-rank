# API Timeout Fix - Queue Stats Endpoint

## Issue
During load testing with 100 concurrent users, the `/api/queue/stats` endpoint experienced timeouts:
- 2 out of 3528 requests failed (0.05% failure rate)
- Timeout errors: `Get "http://localhost:3000/api/queue/stats": request timeout`
- P95 latency threshold requirement: < 300ms

## Root Cause
The timeout values were too aggressive for high-concurrency scenarios:
1. **Route level**: 150ms timeout in `refreshQueueStats()` 
2. **Service level**: 500ms timeout in `getQueueStats()`

When 100+ concurrent users hit the endpoint simultaneously, Redis queue operations queued up and exceeded these tight timeout thresholds.

## Changes Made

### 1. SubmissionService.js
**File**: `packages/core/src/services/SubmissionService.js`

**Change**: Increased timeout from 500ms → 800ms

```javascript
// Before:
timeout(500) // 500ms timeout for health checks

// After:
timeout(800) // 800ms timeout to handle high concurrency
```

**Rationale**: 
- Allows Redis operations to complete even when multiple concurrent requests queue up
- Still fast enough for health checks (< 1s)
- Fires before route timeout, enabling graceful cache fallback

### 2. Queue Stats Route
**File**: `apps/web/src/app/api/queue/stats/route.js`

**Change**: Increased timeout from 150ms → 1200ms

```javascript
// Before:
timeout(150)

// After:
timeout(1200)
```

**Rationale**:
- Provides sufficient buffer for the underlying service call (800ms) to complete
- Allows service timeout to fire first for graceful degradation
- Route can still return quickly via cache (5s TTL with stale-while-revalidate)
- Prevents premature timeouts during traffic spikes

## Caching Strategy (Unchanged)
The multi-layer caching strategy remains in place to minimize load:

1. **Cache HIT**: Returns immediately if cache is fresh (< 5s old)
2. **Stale-while-revalidate**: Returns stale data (< 10s old) + refreshes in background
3. **Cache MISS**: Fetches synchronously, then caches for 5s
4. **Fallback**: Returns stale cache or 503 with default values on error

## Expected Results

### Before Fix
```
❌ 2 failed requests (0.05% rate)
⚠️  Some p95 > 300ms (timeouts)
✓  http_req_failed: rate=0.05%
```

### After Fix
```
✅ 0 failed requests (0% rate)
✅ p95 < 300ms consistently
✅ Cache hit rate > 80%
✅ No timeouts under 100 concurrent users
```

## Testing

Run the smoke test to verify:

```powershell
npm run k6:smoke-100
```

### Success Criteria
- ✅ `http_req_failed: rate<0.01` (must be < 1%)
- ✅ `http_req_duration{name:QueueStats}: p(95)<300ms`
- ✅ All checks pass: "queue stats status is 200 or 503"
- ✅ All checks pass: "queue stats response < 300ms"
- ✅ No timeout errors in logs

## Performance Considerations

### Timeout Hierarchy
The timeouts are properly layered to ensure graceful degradation:

```
k6 test timeout: 2000ms (test harness)
    ↓
Route timeout: 1200ms (API endpoint)
    ↓
Service timeout: 800ms (Redis operations)
```

**Why this order matters:**
1. Service timeout (800ms) fires first when Redis is slow
2. Service returns cached/default values
3. Route receives the response and returns it
4. If route times out (1200ms), cache layers still protect the API
5. Test timeout (2000ms) is the final safety net

### Actual Values Implemented
- **Service timeout**: 500ms → **800ms** (60% increase)
- **Route timeout**: 150ms → **1200ms** (8x increase)

This ensures:
- ✅ Service has time to query Redis under load
- ✅ Route has time to receive service response
- ✅ Cache fallback works reliably
- ✅ No premature timeouts during traffic spikes
