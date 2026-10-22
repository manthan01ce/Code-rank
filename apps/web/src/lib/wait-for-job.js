// Polling is authoritative. Socket notifications only shorten the wait.
export function waitForJob({ jobId, socket, token, timeoutMs = 60000, fetchImpl = fetch }) {
  return new Promise((resolve, reject) => {
    let settled = false, timer, attempt = 0;
    const controller = new AbortController();
    const cleanup = () => {
      clearTimeout(timer); clearTimeout(deadline); controller.abort();
      socket?.off('job_complete', onComplete);
      socket?.emit('unwatch_job', jobId);
    };
    const finish = (error, result) => {
      if (settled) return;
      settled = true; cleanup();
      if (error) reject(error); else resolve(result);
    };
    const onComplete = result => {
      if (result?.jobId === jobId) finish(null, result);
    };
    const deadline = setTimeout(() => finish(new Error('Execution wait timed out. Please check your submissions before retrying.')), timeoutMs);
    socket?.on('job_complete', onComplete);
    socket?.emit('watch_job', jobId);
    const poll = async () => {
      if (settled) return;
      try {
        const response = await fetchImpl(`/api/jobs/${encodeURIComponent(jobId)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal, cache: 'no-store',
        });
        if ([401, 403, 404].includes(response.status)) return finish(new Error('Execution job is unavailable or access was denied'));
        if (response.ok) {
          const job = await response.json();
          if (job.status === 'completed') return finish(null, job.result);
          if (job.status === 'failed') return finish(new Error('Execution failed. Please try again.'));
        }
      } catch { /* Transient transport failures retry until the bounded deadline. */ }
      if (!settled) timer = setTimeout(poll, Math.min(1000, 250 * (2 ** attempt++)));
    };
    poll();
  });
}
