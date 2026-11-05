import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { closeDatabase } from '@coderank/database';

// Import smoke only. Real Redis/recovery and Docker execution remain separate gates.
const workers = [{ id: 'execution' }, { id: 'system' }];
let shutdownOptions;
mock.module('../../apps/worker/src/jobs/execution/submission.worker.js', {
  namedExports: { createSubmissionWorker: () => ({ worker: workers[0], disconnectRealtime() {} }) },
});
mock.module('../../apps/worker/src/jobs/system/system.worker.js', {
  namedExports: { createSystemWorker: () => workers[1] },
});
mock.module('../../apps/worker/src/lifecycle/heartbeat.js', {
  namedExports: { startExecutionHeartbeat: () => ({ stop: async () => {} }) },
});
mock.module('@coderank/runner/sandbox', {
  namedExports: { assertColdSandboxConfiguration: () => {}, startSandboxReaper: () => ({ stop: async () => {} }) },
});
mock.module('../../apps/worker/src/lifecycle/shutdown.js', {
  namedExports: { createShutdown: options => { shutdownOptions = options; return async () => 0; } },
});

test('worker bootstrap links the supported database close export for drain', async t => {
  t.mock.method(console, 'log', () => {});
  const before = new Map(['SIGINT', 'SIGTERM'].map(signal => [signal, process.listeners(signal)]));
  try {
    await import('../../apps/worker/src/index.js');
    assert.equal(shutdownOptions.afterDrain, closeDatabase);
    assert.deepEqual(shutdownOptions.workers.slice(0, 2), workers);
    await shutdownOptions.afterDrain();
  } finally {
    for (const [signal, listeners] of before) {
      for (const listener of process.listeners(signal)) if (!listeners.includes(listener)) process.removeListener(signal, listener);
    }
  }
});
