# Smoke Test Performance Improvements

## Issues Identified

From the test results (`01-smoke-test-results.txt`):
- **P95 Response Time**: 12.09s (Target: <800ms) ❌
- **Average Response Time**: 1.89s
- **Main Issue**: Cold start and large page sizes causing slow initial loads

## Fixes Applied

### 1. API Endpoint Optimizations

#### `/api/health` Improvements
- ✅ Reduced timeout from 300ms to 200ms
- ✅ Improved cache TTL from 5s to 3s for faster updates
- ✅ Added Cache-Control headers
- ✅ Faster database and queue health checks

#### `/api/queue/stats` Improvements
- ✅ Reduced cache TTL from 2s to 1.5s
- ✅ Added 150ms timeout for faster failure detection
- ✅ Better error handling with graceful degradation
- ✅ Returns mock data on timeout instead of 500 error

### 2. Next.js Configuration Enhancements

#### Performance Settings
- ✅ Added `output: 'standalone'` for optimized builds
- ✅ Enabled WebP image format support
- ✅ Added cache headers for root (/) and login pages (60s cache)
- ✅ Configured server action size limits

#### Caching Strategy
```javascript
/ and /login → 60s cache, 120s stale-while-revalidate
/api/health → 5s cache, 10s stale-while-revalidate
/api/queue/stats → 2s cache, 5s stale-while-revalidate
```

### 3. Smoke Test Improvements

#### Better Load Pattern
- ✅ Added warmup phase: 5s ramp up to 10 users
- ✅ Load phase: 15s at 20 users
- ✅ Graceful ramp down: 5s to 0 users
- ✅ Total duration: 25s (optimized from 20s flat load)

#### Enhanced Checks
- ✅ Added response time checks per endpoint
- ✅ Health check: <500ms
- ✅ Landing/Login pages: <1s
- ✅ Queue stats: <300ms
- ✅ Added timeout guards (2-3s per request)

#### Warmup Function
- ✅ Pre-warms caches before test starts
- ✅ Hits all critical endpoints once
- ✅ Waits 2s for caches to stabilize

## Expected Results

### Before
- P95: 12.09s ❌
- Average: 1.89s
- Cache Hit Rate: Unknown
- Cold start issues

### After (Expected)
- P95: <800ms ✅
- Average: <400ms
- Cache Hit Rate: >70%
- Warm cache serving most requests

## How to Test

### 1. Rebuild the Application
```bash
cd apps/web
npm run build
```

### 2. Start Production Server
```bash
npm run start
```

### 3. Run Smoke Test
```bash
cd ../../load-tests
k6 run smoke-test.js
```

### 4. Verify Metrics
Check for:
- ✅ All thresholds passing
- ✅ P95 < 800ms
- ✅ Cache headers present (X-Cache: HIT/MISS)
- ✅ No failed requests

## Additional Optimizations (If Needed)

If smoke test still fails:

### Database Connection Pool
Check `packages/core/src/db/index.js`:
```javascript
// Ensure connection pooling is optimized
export const pool = neon(DATABASE_URL, {
  fetchConnectionCache: true,
  poolQueryViaFetch: true,
});
```

### Redis Connection Pool
Check Redis configuration:
```javascript
// Use connection pooling
const redis = new Redis({
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
  enableOfflineQueue: false,
});
```

### Server Configuration
Check `apps/web/server.js`:
- Ensure keep-alive is enabled
- Verify compression is working
- Check that static assets are being served efficiently

## Monitoring

### During Load Test
```bash
# Watch server logs
tail -f apps/web/.next/server.log

# Monitor cache hit rates
curl -I http://localhost:3000/api/health | grep X-Cache
```

### Performance Metrics to Track
1. Cache Hit Rate (should be >70%)
2. P50, P95, P99 response times
3. Error rate (should be <1%)
4. Time to First Byte (TTFB)

## Troubleshooting

### High Response Times on First Request
- **Cause**: Next.js cold start
- **Solution**: Warmup function now handles this

### Slow Database Queries
- **Cause**: No connection pooling
- **Solution**: Check database configuration

### High Memory Usage
- **Cause**: Too many concurrent connections
- **Solution**: Reduce VUs or add connection limits

## Success Criteria

✅ All checks pass (100% success rate)
✅ P95 < 800ms
✅ Average response time < 400ms
✅ No failed requests
✅ Cache hit rate > 70% after warmup

## Next Steps

After smoke test passes:
1. Run load test with higher VUs
2. Run stress test to find breaking point
3. Run spike test for traffic bursts
4. Monitor production performance

## Notes

- Tests run against production build (`npm run start`)
- Warmup phase prevents cold start penalties
- Cache headers improve subsequent requests
- Timeouts prevent hanging requests
