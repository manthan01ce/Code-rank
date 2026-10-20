import { jobLifetime } from '@coderank/runner/sandbox';

// The deadline covers Redis pause/close as well as active execution draining.
export function createShutdown({ workers, socket, graceMs = process.env.SHUTDOWN_GRACE_MS, log = console }) {
  const defaultGrace = jobLifetime() + 15000;
  const configured = Number(graceMs ?? defaultGrace);
  const deadlineMs = Number.isFinite(configured) && configured > 0 ? Math.min(configured, 180000) : defaultGrace;
  let pending;
  return () => pending ||= (async () => {
    let timer;
    try {
      await Promise.race([
        (async () => {
          await Promise.all(workers.map(worker => worker.pause(true)));
          await Promise.all(workers.map(worker => worker.close()));
        })(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Worker graceful shutdown deadline exceeded')), deadlineMs);
        }),
      ]);
      log.info('Worker: active jobs drained; shutdown complete.');
      return 0;
    } catch (error) {
      log.error('Worker: graceful shutdown failed:', error.message);
      return 1;
    } finally {
      clearTimeout(timer);
      socket.disconnect();
    }
  })();
}
