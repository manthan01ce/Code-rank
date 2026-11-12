import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
export const SESSION_COOKIE = 'coderank_analytics';
const SESSION_SECONDS = 3600;
const IDLE_SECONDS = 900;
const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });

export function analyticsConfig(env = process.env) {
  if (!env.ANALYTICS_PASSWORD_HASH || !env.ANALYTICS_SESSION_SECRET || !env.ANALYTICS_ORIGIN) throw fail(503, 'Analytics access is not configured. Ask the operator to configure it.');
  if (!/^scrypt\$[a-f0-9]{64}\$[a-f0-9]{128}$/.test(env.ANALYTICS_PASSWORD_HASH) || env.ANALYTICS_SESSION_SECRET.length < 32) throw fail(503, 'Analytics access configuration is invalid.');
  let origin;
  try { origin = new URL(env.ANALYTICS_ORIGIN); } catch { throw fail(503, 'Analytics origin configuration is invalid.'); }
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash || (origin.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname))) throw fail(503, 'Analytics requires an HTTPS origin, or localhost for development.');
  const version = createHmac('sha256', env.ANALYTICS_SESSION_SECRET).update(env.ANALYTICS_PASSWORD_HASH).digest('hex');
  return { hash: env.ANALYTICS_PASSWORD_HASH, secret: env.ANALYTICS_SESSION_SECRET, origin: origin.origin, secure: origin.protocol === 'https:', version };
}

export async function hashAnalyticsPassword(password) {
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 512) throw Error('Choose an analytics password of 8 or more characters, up to 512 bytes.');
  const salt = randomBytes(32).toString('hex');
  const key = await derive(password, salt, 64);
  return `scrypt$${salt}$${key.toString('hex')}`;
}

export async function verifyAnalyticsPassword(password, hash) {
  if (typeof password !== 'string' || Buffer.byteLength(password) > 512) return false;
  const [, salt, expected] = hash.split('$');
  const actual = await derive(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}

export function analyticsCookie(token, config, clear = false) {
  return `${SESSION_COOKIE}=${token}; Path=/api/analytics; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : SESSION_SECONDS}${config.secure ? '; Secure' : ''}`;
}

export function cookieToken(request) {
  const values = (request.headers.cookie || '').split(';').map(part => part.trim()).filter(part => part.startsWith(`${SESSION_COOKIE}=`));
  if (values.length !== 1) return null;
  const token = values[0].slice(SESSION_COOKIE.length + 1);
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}
const digest = token => createHash('sha256').update(token).digest('hex');

export function createAnalyticsAuth(query) {
  return {
    async audit(action, detail = '') {
      await query('INSERT INTO analytics_access(action,detail) VALUES($1,$2)', [action, detail]);
    },
    async login(request, reply, config) {
      // Use the trusted socket address, not a client-supplied forwarding header.
      // Behind a proxy, this deliberately shares the limit across proxy clients.
      const bucket = createHmac('sha256', config.secret).update(request.ip || 'unknown').digest('hex');
      const [attempt] = await query(`INSERT INTO analytics_login_limits(bucket,window_start,attempts) VALUES($1,date_trunc('minute',now()),1)
        ON CONFLICT(bucket) DO UPDATE SET window_start=date_trunc('minute',now()), attempts=CASE WHEN analytics_login_limits.window_start=date_trunc('minute',now()) THEN analytics_login_limits.attempts+1 ELSE 1 END RETURNING attempts`, [bucket]);
      if (Number(attempt.attempts) > 5) { reply.header('Retry-After', '60'); throw fail(429, 'Too many analytics login attempts. Try again in one minute.'); }
      if (!await verifyAnalyticsPassword(request.body?.password, config.hash)) {
        await this.audit('LOGIN_FAILED');
        throw fail(401, 'Incorrect analytics password.');
      }
      const token = randomBytes(32).toString('hex');
      await query(`INSERT INTO analytics_sessions(token_hash,password_version,expires_at,last_seen) VALUES($1,$2,now()+interval '1 hour',now())`, [digest(token), config.version]);
      await this.audit('LOGIN');
      // Replace an existing session on this browser as part of rotation.
      const old = cookieToken(request);
      if (old) await query('DELETE FROM analytics_sessions WHERE token_hash=$1', [digest(old)]);
      reply.header('Set-Cookie', analyticsCookie(token, config));
      return { authenticated: true, expiresInSeconds: SESSION_SECONDS, idleTimeoutSeconds: IDLE_SECONDS };
    },
    async require(request, config) {
      const token = cookieToken(request);
      if (!token) throw fail(401, 'Analytics sign-in required.');
      const [session] = await query(`UPDATE analytics_sessions SET last_seen=now() WHERE token_hash=$1 AND password_version=$2 AND expires_at>now() AND last_seen>now()-interval '15 minutes' RETURNING token_hash,expires_at`, [digest(token), config.version]);
      if (!session) throw fail(401, 'Analytics session expired. Sign in again.');
      request.analyticsSession = session;
      return session;
    },
    async logout(request, reply, config) {
      const token = cookieToken(request);
      if (token) await query('DELETE FROM analytics_sessions WHERE token_hash=$1', [digest(token)]);
      await this.audit('LOGOUT');
      reply.header('Set-Cookie', analyticsCookie('', config, true));
      return { authenticated: false };
    },
  };
}

export function requireAnalyticsOrigin(request, config) {
  if (request.headers.origin !== config.origin || request.headers['x-analytics-request'] !== '1') throw fail(403, 'Analytics request origin is not allowed.');
}
