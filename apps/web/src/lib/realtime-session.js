/** Bound the lifetime of idle subscriptions as well as incoming events.
 * Authenticated browsers revalidate every 30 seconds. Service sockets expire
 * with their token and reconnect with fresh service credentials. Guest sockets
 * have a fixed session lifetime and never issue database identity lookups.
 */
export function guardRealtimeSession(socket, {
  revalidate,
  expiresAt,
  intervalMs = 30000,
  now = Date.now,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  let closed = false, refreshTimer, expiryTimer;
  const close = () => {
    closed = true;
    if (refreshTimer) clearTimer(refreshTimer);
    if (expiryTimer) clearTimer(expiryTimer);
  };
  const revoke = () => {
    if (closed) return;
    close();
    // Disconnect removes all rooms, preventing further broadcasts to revoked
    // or expired subscribers even when they send no events themselves.
    socket.disconnect(true);
  };
  const refresh = async () => {
    if (closed) return;
    try { await revalidate(); }
    catch { revoke(); return; }
    if (!closed) schedule();
  };
  const schedule = () => {
    refreshTimer = setTimer(refresh, intervalMs);
    refreshTimer.unref?.();
  };
  socket.on('disconnect', close);
  if (Number.isFinite(expiresAt)) {
    // JavaScript timers overflow above 2^31-1ms; JWT lifetime here is seven
    // days, and guest lifetime is one day, both within that limit.
    expiryTimer = setTimer(revoke, Math.max(0, Math.min(2147483647, expiresAt - now())));
    expiryTimer.unref?.();
  }
  if (revalidate) schedule();
  return close;
}
