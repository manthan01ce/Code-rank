import { createClient } from 'redis';
import { randomUUID } from 'crypto';
import { withTimeout } from '@coderank/core/utils/timeout';
import { CircuitBreaker } from '@coderank/core/utils/circuit-breaker';

let redis = null;
let redisConnecting = null;

// Circuit breaker for Redis operations: 5 failures to open, 30s recovery
const redisCircuitBreaker = new CircuitBreaker('redis', {
  failureThreshold: 5,
  recoveryTimeout: 30000
});

async function getRedis() {
  if (redis && redis.isOpen) return redis;
  if (redisConnecting) return redisConnecting;

  redisConnecting = (async () => {
    try {
      const client = createClient({
        disableOfflineQueue: true,
        socket: { 
          host: process.env.REDIS_HOST || '127.0.0.1', 
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          connectTimeout: 1000,
          reconnectStrategy: false
        }
      });
      client.on('error', () => {}); // Silently catch offline errors
      await client.connect();
      redis = client;
      return redis;
    } catch {
      redis = null;
      return null;
    } finally {
      redisConnecting = null;
    }
  })();

  return redisConnecting;
}

const LIMITS = {
  submit:  { windowMs: 60000, max: parseInt(process.env.RATE_LIMIT_SUBMIT  || '5', 10)  },
  run:     { windowMs: 60000, max: parseInt(process.env.RATE_LIMIT_RUN     || '15', 10) },
  login:   { windowMs: 60000, max: parseInt(process.env.RATE_LIMIT_LOGIN   || '5', 10)  },
  default: { windowMs: 60000, max: parseInt(process.env.RATE_LIMIT_DEFAULT || '60', 10) },
};

// One Redis round-trip and atomic mutation prevents concurrent requests from
// observing the same count and both being accepted at a rate-limit boundary.
const RATE_LIMIT_SCRIPT = `
  redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
  local count = redis.call('ZCARD', KEYS[1])
  if count >= tonumber(ARGV[5]) then return count + 1 end
  redis.call('ZADD', KEYS[1], ARGV[2], ARGV[3])
  count = count + 1
  redis.call('PEXPIRE', KEYS[1], ARGV[4])
  return count
`;

export async function checkRateLimit(identifier, category = 'default') {
  // Check if rate limiting is disabled
  if (process.env.DISABLE_RATE_LIMIT === 'true') {
    return { allowed: true };
  }

  const limit = LIMITS[category] || LIMITS.default;
  const key = `rl:${category}:${identifier}`;
  const now = Date.now();
  const windowStart = now - limit.windowMs;

  try {
    // Wrap Redis operations with circuit breaker
    return await redisCircuitBreaker.execute(async () => {
      const client = await getRedis();
      if (!client) throw new Error('Redis client unavailable');

      let count;
      try { count = await withTimeout(client.eval(RATE_LIMIT_SCRIPT, {
        keys: [key],
        arguments: [
          String(windowStart),
          String(now),
          `${now}-${randomUUID()}`,
          String(limit.windowMs),
          String(limit.max),
        ],
      }), 1000); } catch (error) {
        client.destroy?.();
        if (redis === client) redis = null;
        throw error;
      }
      
      if (count > limit.max) {
        return { allowed: false, retryAfter: Math.ceil(limit.windowMs / 1000) };
      }
      return { allowed: true };
    });
  } catch (err) {
    console.warn('[RateLimit] Unavailable:', err.message);
    if (['login', 'submit', 'run'].includes(category)) {
      return { allowed: false, unavailable: true };
    }
    return { allowed: true, unavailable: true };
  }
}

