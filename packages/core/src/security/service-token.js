import jwt from 'jsonwebtoken';

export function createServiceToken() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required');
  return jwt.sign({ role: 'service' }, process.env.JWT_SECRET, {
    expiresIn: '5m', audience: 'coderank-realtime', issuer: 'coderank-worker', algorithm: 'HS256',
  });
}

export function verifyServiceToken(token) {
  try {
    const value = jwt.verify(token, process.env.JWT_SECRET, {
      audience: 'coderank-realtime', issuer: 'coderank-worker', algorithms: ['HS256'],
    });
    return value.role === 'service' ? value : null;
  } catch { return null; }
}
