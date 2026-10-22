import sql from '../db/client.js';
import { verifyToken } from '../utils/auth.js';

const unauthorized = () => { throw { status: 401, message: 'Authentication required or session expired' }; };

/** Validate current database authority as well as the JWT signature.
 * Do not cache this lookup: account deactivation and session rotation must apply
 * to the next protected request, including faculty and administrator requests.
 */
export async function authenticateToken(token, { query = (...args) => sql.query(...args) } = {}) {
  if (typeof token !== 'string' || !token) return unauthorized();
  const claims = verifyToken(token);
  const id = Number(claims?.id);
  if (!claims || !Number.isSafeInteger(id) || id < 1) return unauthorized();
  let rows;
  try {
    rows = await query('SELECT id,name,email,role,status,session_token FROM users WHERE id=$1', [id]);
  } catch {
    throw { status: 503, message: 'Authentication service unavailable' };
  }
  const user = rows[0];
  if (!user || user.status !== 'active' || user.role !== claims.role || Number(user.id) !== id) return unauthorized();
  // Legacy accounts with no persisted session may use a sessionless JWT until
  // their next login rotates the session. Never accept a mismatched/nonempty
  // JWT session against a cleared database session.
  if ((user.session_token ?? null) !== (claims.session_token ?? null)) return unauthorized();
  return { ...claims, id, role: user.role, name: user.name, email: user.email };
}

export async function authenticateRequest(request, { optional = false, ...options } = {}) {
  const headers = request?.headers;
  const authorization = typeof headers?.get === 'function'
    ? headers.get('authorization') : headers?.authorization;
  if (authorization === undefined || authorization === null) {
    if (optional) return null;
    return unauthorized();
  }
  if (typeof authorization !== 'string' || !/^Bearer [^\s]+$/.test(authorization)) return unauthorized();
  return authenticateToken(authorization.slice(7), options);
}
