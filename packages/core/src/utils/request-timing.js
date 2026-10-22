// Standard Server-Timing durations only. Never include identity, input, credentials or SQL.
export function requestTiming() {
  const values = new Map();
  return {
    record(name, duration) {
      if (/^[a-z_]+$/.test(name) && Number.isFinite(duration) && duration >= 0) values.set(name, duration);
    },
    header() { return [...values].map(([name, duration]) => `${name};dur=${duration.toFixed(2)}`).join(', '); },
  };
}
