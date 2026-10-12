import { createClient } from 'redis';

let redis = null;
let redisConnecting = null;

async function getRedis() {
  if (redis && redis.isOpen) return redis;
  if (redisConnecting) return redisConnecting;

  redisConnecting = (async () => {
    try {
      const client = createClient({
        socket: { 
          host: process.env.REDIS_HOST || '127.0.0.1', 
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          connectTimeout: 2000,
          reconnectStrategy: (retries) => (retries > 3 ? false : Math.min(retries * 500, 2000))
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
    const client = await getRedis();
    if (!client) return { allowed: true };

    const multi = client.multi();
    multi.zRemRangeByScore(key, '-inf', windowStart);
    multi.zAdd(key, [{ score: now, value: `${now}-${Math.random()}` }]);
    multi.zCard(key);
    multi.expire(key, Math.ceil(limit.windowMs / 1000));
    
    const results = await multi.exec();
    const count = results[2];
    
    if (count > limit.max) {
      return { allowed: false, retryAfter: Math.ceil(limit.windowMs / 1000) };
    }
    return { allowed: true };
  } catch (err) {
    console.error('Rate limit error, failing open:', err);
    return { allowed: true };
  }
}

