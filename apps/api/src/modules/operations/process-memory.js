// Restricted hosts may not expose the OS facilities used by Node's RSS probe.
// An unavailable measurement must not discard unrelated operational diagnostics.
export function readProcessMemory(read = () => process.memoryUsage()) {
  try {
    return read();
  } catch {
    return {
      rss: null,
      heapTotal: null,
      heapUsed: null,
      external: null,
      arrayBuffers: null,
      available: false,
      error: 'PROCESS_MEMORY_UNAVAILABLE',
    };
  }
}
