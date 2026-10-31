// Standard Server-Timing durations only. Never include identity, input, credentials or SQL.
export function requestTiming() {
  const allowed = new Set(['rate_limit','lookup','password_compare','session_commit','auth','validation','password_hash','database_commit']);
  const values = new Map();
  return {
    record(name, duration) {
      if (allowed.has(name) && Number.isFinite(duration) && duration >= 0) values.set(name, duration);
    },
    header() { return [...values].map(([name, duration]) => `${name};dur=${duration.toFixed(2)}`).join(', '); },
  };
}
