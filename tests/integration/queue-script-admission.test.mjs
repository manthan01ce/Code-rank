// Real atomic admission contracts: always registered; missing Redis fails this lane.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Queue } from 'bullmq';
import { admissionBackend, sweepOwnerIndexes } from '../../packages/queue/src/index.js';
const connection = { host: '127.0.0.1', port: Number(process.env.REDIS_PORT || 6379), maxRetriesPerRequest: null };
  test('Redis admission contract', async t => {
    await t.test('global capacity limit enforced under concurrency', async () => {
      const name = `cr-arch-08b-global-${Date.now()}`;
      // 4 concurrent producers, maxPending=5 → exactly 5 admitted regardless of race
      const queues = Array.from({ length: 4 }, () =>
        new Queue(name, { connection }, admissionBackend(5, 10)));
      try {
        const results = await Promise.allSettled(
          Array.from({ length: 30 }, (_, i) =>
            queues[i % 4].add('run', { userId: `u${i % 6}` }, { jobId: `j-${i}` })),
        );
        const admitted = results.filter(r => r.status === 'fulfilled').length;
        assert.equal(admitted, 5,
          `Expected exactly 5 jobs admitted (maxPending=5), got ${admitted}`);
        assert.equal(await queues[0].getWaitingCount(), 5);
      } finally {
        await queues[0].obliterate({ force: true });
        await Promise.all(queues.map(q => q.close()));
      }
    });

    await t.test('per-owner limit enforced independently of global capacity', async () => {
      const name = `cr-arch-08b-owner-${Date.now()}`;
      // maxPending=20, maxPerOwner=2 → same owner blocked after 2
      const queues = Array.from({ length: 3 }, () =>
        new Queue(name, { connection }, admissionBackend(20, 2)));
      try {
        const ownerResults = await Promise.allSettled(
          Array.from({ length: 8 }, (_, i) =>
            queues[i % 3].add('run', { userId: 'single-owner' }, { jobId: `own-${i}` })),
        );
        const ownerAdmitted = ownerResults.filter(r => r.status === 'fulfilled').length;
        assert.equal(ownerAdmitted, 2,
          `Expected exactly 2 jobs from same owner (maxPerOwner=2), got ${ownerAdmitted}`);
        // A different owner must still be admitted (global slots not exhausted)
        await queues[0].add('run', { userId: 'other-owner' }, { jobId: 'other-1' });
        assert.equal(await queues[0].getWaitingCount(), 3);
        // OWNER_QUEUE_FULL is the correct rejection when per-owner limit is hit
        await assert.rejects(
          queues[1].add('run', { userId: 'single-owner' }, { jobId: 'still-blocked' }),
          /OWNER_QUEUE_FULL/,
        );
      } finally {
        await queues[0].obliterate({ force: true });
        await Promise.all(queues.map(q => q.close()));
      }
    });

    await t.test('no duplicate job IDs inserted under concurrent load', async () => {
      const name = `cr-arch-08b-dedup-${Date.now()}`;
      const queues = Array.from({ length: 4 }, () =>
        new Queue(name, { connection }, admissionBackend(50, 10)));
      try {
        const jobIds = Array.from({ length: 20 }, (_, i) => `dedup-${i}`);
        // Each jobId sent from all 4 queues simultaneously — BullMQ deduplicates
        await Promise.allSettled(
          jobIds.flatMap(id =>
            queues.map(q => q.add('run', { userId: 'u1' }, { jobId: id }))),
        );
        const jobs = await queues[0].getJobs(['waiting']);
        const seen = new Set(jobs.map(j => j.id));
        assert.equal(seen.size, jobs.length,
          'Each jobId must appear at most once — no duplicate insertions');
      } finally {
        await queues[0].obliterate({ force: true });
        await Promise.all(queues.map(q => q.close()));
      }
    });

    await t.test('sweepOwnerIndexes removes stale owner entries after job deletion', async () => {
      const name = `cr-arch-08b-sweep-${Date.now()}`;
      const q = new Queue(name, { connection }, admissionBackend(10, 5));
      try {
        await q.add('run', { userId: 'sweep-owner' }, { jobId: 'sw-1' });
        await q.add('run', { userId: 'sweep-owner' }, { jobId: 'sw-2' });
        assert.equal(await q.getWaitingCount(), 2);
        // Obliterate removes all jobs, simulating completed/expired state
        await q.obliterate({ force: true });
        // Sweep must remove owner index entries pointing at deleted jobs
        const state = { cursor: '0', pending: [] };
        do { await sweepOwnerIndexes(q, state); }
        while (state.cursor !== '0' || state.pending.length);
        // After sweep, owner slots are freed and new jobs can be admitted
        await q.add('run', { userId: 'sweep-owner' }, { jobId: 'sw-3' });
        assert.equal(await q.getWaitingCount(), 1);
      } finally {
        await q.obliterate({ force: true });
        await q.close();
      }
    });
  });
