/** A single authenticated JSON page, preserving public pagination headers. */
export async function requestPage(url, token, { signal, method = 'GET' } = {}) {
  const response = await fetch(url, {
    method, signal, headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return { data, nextCursor: response.headers.get('X-Next-Cursor') || null };
}

/** Abort superseded work and reject late results even when fetch ignores abort. */
export function createRequestScope() {
  let controller;
  let version = 0;
  return {
    cancel() { version += 1; controller?.abort(); },
    begin() {
      controller?.abort();
      controller = new AbortController();
      const current = ++version;
      const signal = controller.signal;
      return { signal, isCurrent: () => current === version && !signal.aborted };
    },
  };
}
