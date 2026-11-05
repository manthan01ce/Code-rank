import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

class FakeWorker {
  constructor(name, processor, options) { Object.assign(this, { name, processor, options, listeners: new Map() }); }
  on(event, listener) { this.listeners.set(event, listener); return this; }
}
mock.module('bullmq', { namedExports: { Worker: FakeWorker } });
class FakeSocket {
  listeners = new Map();
  connects = 0;
  on(event, listener) { this.listeners.set(event, listener); return this; }
  emissions = [];
  emit(event, payload) { this.emissions.push({ event, payload }); }
  disconnect() {}
  connect() { this.connects++; }
}
mock.module('socket.io-client', { namedExports: { io: () => new FakeSocket() } });
const { createSubmissionWorker } = await import('../apps/worker/src/jobs/execution/submission.worker.js');
const { createSystemWorker } = await import('../apps/worker/src/jobs/system/system.worker.js');

test('submission worker rejects invalid concurrency before allocating a queue worker', () => {
  const original = process.env.MAX_CONCURRENT_JOBS;
  try {
    for (const value of ['nope', '0', '-1', '1.5', '65', 'Infinity']) {
      process.env.MAX_CONCURRENT_JOBS = value;
      assert.throws(() => createSubmissionWorker(), /integer between 1 and 64/);
    }
  } finally {
    if (original === undefined) delete process.env.MAX_CONCURRENT_JOBS; else process.env.MAX_CONCURRENT_JOBS = original;
  }
});

test('service token expiration reconnects with fresh auth while explicit shutdown prevents reconnect', t => {
  t.mock.method(console, 'log', () => {});
  const { socket, disconnectRealtime } = createSubmissionWorker();
  socket.listeners.get('disconnect')('io server disconnect');
  assert.equal(socket.connects, 1);
  socket.listeners.get('disconnect')('io client disconnect');
  assert.equal(socket.connects, 1);
  disconnectRealtime();
  socket.listeners.get('disconnect')('io server disconnect');
  assert.equal(socket.connects, 1);
});

test('worker lock duration remains finite with invalid environment and errors have listeners', t => {
  const originalTimeout = process.env.JOB_TIMEOUT_MS;
  const originalConcurrency = process.env.MAX_CONCURRENT_JOBS;
  t.mock.method(console, 'log', () => {});
  try {
    process.env.JOB_TIMEOUT_MS = 'not-a-duration';
    process.env.MAX_CONCURRENT_JOBS = '4';
    const { worker } = createSubmissionWorker();
    assert.equal(worker.options.concurrency, 4);
    assert.equal(worker.options.lockDuration, 35000);
    assert.equal(typeof worker.listeners.get('error'), 'function');
    assert.equal(typeof createSystemWorker().listeners.get('error'), 'function');
  } finally {
    if (originalTimeout === undefined) delete process.env.JOB_TIMEOUT_MS; else process.env.JOB_TIMEOUT_MS = originalTimeout;
    if (originalConcurrency === undefined) delete process.env.MAX_CONCURRENT_JOBS; else process.env.MAX_CONCURRENT_JOBS = originalConcurrency;
  }
});


test('extracted publisher redacts hidden cases and keeps terminal failures generic', async t => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'error', () => {});
  const { worker, socket, disconnectRealtime } = createSubmissionWorker();
  const job = { id: 'synthetic-job', data: { userId: 7 }, processedOn: 1, finishedOn: 2 };
  await worker.listeners.get('completed')(job, { cases: [{ is_hidden: true, passed: false, stdout: 'private output', input: 'private input' }] });
  assert.deepEqual(socket.emissions[0], { event: 'worker_job_complete', payload: { jobId: job.id, result: { cases: [{ is_hidden: true, passed: false }] } } });
  worker.listeners.get('failed')(job, new Error('internal diagnostic'));
  assert.deepEqual(socket.emissions[1].payload.result, { status: 'internal_error', summary: 'Execution failed internally', runtimeError: 'Execution failed internally' });
  disconnectRealtime();
});
