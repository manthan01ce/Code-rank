import { monitorEventLoopDelay } from 'node:perf_hooks';

const STATE_KEY = Symbol.for('coderank.web.observability');
const MAX_SAMPLES = 2048;

function createState() {
  const eventLoop = monitorEventLoopDelay({ resolution: 20 });
  eventLoop.enable();
  return {
    startedAt: Date.now(),
    requests: 0,
    errors: 0,
    durations: [],
    endpoints: new Map(),
    eventLoop,
    lastCpu: process.cpuUsage(),
  };
}

const state = globalThis[STATE_KEY] ||= createState();

function routeName(url = '/') {
  return url.split('?')[0]
    .replace(/\/[0-9]+(?=\/|$)/g, '/:id')
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}(?=\/|$)/gi, '/:id');
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] * 100) / 100;
}

export function recordHttpRequest({ url, statusCode, durationMs }) {
  state.requests += 1;
  if (statusCode >= 500) state.errors += 1;
  state.durations.push(durationMs);
  if (state.durations.length > MAX_SAMPLES) state.durations.splice(0, state.durations.length - MAX_SAMPLES);

  const endpoint = routeName(url);
  const current = state.endpoints.get(endpoint) || { requests: 0, errors: 0, durations: [] };
  current.requests += 1;
  if (statusCode >= 500) current.errors += 1;
  current.durations.push(durationMs);
  if (current.durations.length > 256) current.durations.shift();
  state.endpoints.set(endpoint, current);
}

export function getHttpMetrics() {
  const elapsedSeconds = Math.max(1, (Date.now() - state.startedAt) / 1000);
  const cpu = process.cpuUsage(state.lastCpu);
  state.lastCpu = process.cpuUsage();
  const endpoints = [...state.endpoints.entries()]
    .map(([path, values]) => ({
      path,
      requests: values.requests,
      errors: values.errors,
      p95Ms: percentile(values.durations, 0.95),
    }))
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 20);

  return {
    uptimeSeconds: Math.round(process.uptime()),
    requests: state.requests,
    errors: state.errors,
    requestRatePerSecond: Math.round((state.requests / elapsedSeconds) * 100) / 100,
    latencyMs: { p50: percentile(state.durations, 0.5), p90: percentile(state.durations, 0.9), p95: percentile(state.durations, 0.95) },
    process: {
      memory: process.memoryUsage(),
      cpuUserMicrosSinceLastRead: cpu.user,
      cpuSystemMicrosSinceLastRead: cpu.system,
      eventLoopDelayMs: {
        p50: Math.round(state.eventLoop.percentile(50) / 1e4) / 100,
        p95: Math.round(state.eventLoop.percentile(95) / 1e4) / 100,
      },
    },
    endpoints,
  };
}
