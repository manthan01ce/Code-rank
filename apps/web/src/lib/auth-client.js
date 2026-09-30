/**
 * apps/web/src/lib/auth-client.js
 * Client-side authentication helpers for Next.js browser context
 */

export function getClientAuth() {
  if (typeof window === 'undefined') return { token: null, user: null };
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  let user = null;
  if (userStr) {
    try {
      user = JSON.parse(userStr);
    } catch {}
  }
  return { token, user };
}

export function setClientAuth(token, user) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem('token', token);
  if (user) localStorage.setItem('user', JSON.stringify(user));
}

export function clearClientAuth() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}
