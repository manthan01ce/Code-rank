import { createClient } from 'redis';

const redis = createClient({
  socket: { 
    host: process.env.REDIS_HOST || '127.0.0.1', 
    port: parseInt(process.env.REDIS_PORT || '6379', 10) 
  }
});

redis.on('error', (err) => console.error('Redis Rate Limiter Error:', err));
redis.connect().catch(console.error);

const LIMITS = {
  submit:  { windowMs: 60000, max: parseInt(process.env.RATE_LIMIT_SUBMIT  || '5', 10)  },
  run:     { windowMs: 60000, max: parseInt(process.env.RATE_LIMIT_RUN     || '15', 10) },
  login:   { windowMs: 60000, max: parseInt(process.env.RATE_LIMIT_LOGIN   || '5', 10)  },
  default: { windowMs: 60000, max: parseInt(process.env.RATE_LIMIT_DEFAULT || '60', 10) },
};

export async function checkRateLimit(identifier, category = 'default') {
  const limit = LIMITS[category] || LIMITS.default;
  const key = `rl:${category}:${identifier}`;
  const now = Date.now();
  const windowStart = now - limit.windowMs;

  try {
    const multi = redis.multi();
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
