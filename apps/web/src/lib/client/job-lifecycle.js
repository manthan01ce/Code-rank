/** Bounded requests shared by draft saves, enqueue and job polling. */
export async function boundedFetch(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const parent = options.signal;
  const abort = () => controller.abort(parent.reason);
  if (parent?.aborted) abort();
  else parent?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(new Error('Request timed out. Your draft is preserved.')), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); parent?.removeEventListener('abort', abort); }
}
export function responseError(response, body = {}) {
  if (response.status === 401) return 'Your session expired. Sign in again; your draft is preserved.';
  if (response.status === 403) return 'You do not have access to this job or practical.';
  if (response.status === 404) return 'This job is no longer available. Your draft is preserved.';
  if (response.status === 429) return `Too many requests. Retry in ${response.headers.get('Retry-After') || body.retryAfter || 60} seconds.`;
  if (response.status === 503) return 'Execution is unavailable. Please retry shortly; your draft is preserved.';
  return body.error || `Request failed (${response.status}).`;
}
function pause(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}
export async function waitForJob(jobId, { token, signal, onPhase = () => {}, timeoutMs = 60000, intervalMs = 750 } = {}) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const response = await boundedFetch(`/api/jobs/${encodeURIComponent(jobId)}`, {
      signal, cache: 'no-store', headers: token ? { Authorization: `Bearer ${token}` } : {},
    }, Math.min(10000, Math.max(1, end - Date.now())));
    const job = await response.json();
    if (!response.ok) throw new Error(responseError(response, job));
    if (job.status === 'completed') {
      if (!job.result) throw new Error('Job finished without a result. Please recheck your submission history.');
      return job.result;
    }
    if (job.status === 'failed') throw new Error(job.failedReason || 'Execution failed. Your draft is preserved.');
    onPhase(job.status === 'active' ? 'Running' : 'Queued');
    await pause(Math.min(intervalMs, Math.max(0, end - Date.now())), signal);
  }
  throw new Error('Execution exceeded the wait limit. Your job may still finish; check submission history before retrying.');
}
