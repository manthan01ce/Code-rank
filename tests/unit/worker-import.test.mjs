import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
const drainEvents=[];
mock.module('@coderank/database',{namedExports:{closeDatabase:async()=>{drainEvents.push('database-close');}}});

// Import smoke only. Real Redis/recovery and Docker execution remain separate gates.
const workers = [Object.assign(new EventEmitter(),{id:'execution'}), { id: 'system' }];
let shutdownOptions;
mock.module('../../apps/worker/src/jobs/execution/submission.worker.js', {
  namedExports: { createSubmissionWorker: () => ({ worker: workers[0], disconnectRealtime() {}, timings:{stop:async()=>{drainEvents.push('timings-flush');},state:()=>({enabled:false})} }) },
});
mock.module('../../apps/worker/src/jobs/system/system.worker.js', {
  namedExports: { createSystemWorker: () => workers[1] },
});
mock.module('../../apps/worker/src/lifecycle/heartbeat.js', {
  namedExports: { startExecutionHeartbeat: () => ({ stop: async () => {} }) },
});
mock.module('@coderank/runner/sandbox', {
  namedExports: { readSandboxContainers: async()=>({status:'unavailable',running:null}), assertColdSandboxConfiguration: () => {}, startSandboxReaper: () => ({ stop: async () => {} }) },
});
mock.module('../../apps/worker/src/lifecycle/shutdown.js', {
  namedExports: { createShutdown: options => { shutdownOptions = options; return async () => 0; } },
});

test('worker bootstrap links the supported database close export for drain', async t => {
  t.mock.method(console, 'log', () => {});
  const before = new Map(['SIGINT', 'SIGTERM'].map(signal => [signal, process.listeners(signal)]));
  try {
    await import('../../apps/worker/src/index.js');
    assert.equal(typeof shutdownOptions.afterDrain, 'function');
    assert.deepEqual(shutdownOptions.workers.slice(0, 2), workers);
    await shutdownOptions.afterDrain();
    assert.deepEqual(drainEvents,['timings-flush','database-close'],'Recording flush must finish before the database closes');
  } finally {
    for (const [signal, listeners] of before) {
      for (const listener of process.listeners(signal)) if (!listeners.includes(listener)) process.removeListener(signal, listener);
    }
  }
});
