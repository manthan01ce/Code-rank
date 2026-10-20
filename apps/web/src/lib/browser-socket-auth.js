// Read at each connection attempt so reconnects use the current session.
export function browserSocketAuth(storage) {
  const token = storage.getItem('token');
  return token ? { token } : {};
}
