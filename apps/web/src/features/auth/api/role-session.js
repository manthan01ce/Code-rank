/** Client navigation gate only; API remains the authority. */
export function roleSession(storage, role) {
  try {
    const token = storage.getItem('token');
    const user = JSON.parse(storage.getItem('user') || 'null');
    const allowed = user?.role === role || (role === 'faculty' && user?.role === 'admin');
    return token && allowed ? { token, isReady: true } : { token: null, isReady: false };
  } catch { return { token: null, isReady: false }; }
}
