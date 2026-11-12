// Read only current telemetry. Historical throughput is not inferred from retained jobs.
export function summarizeWorkerRecords(records, now = Date.now()) {
  const workers = [];
  for (const value of records) {
    try {
      const row = JSON.parse(value);
      if (typeof row.id !== 'string' || !Number.isFinite(row.checkedAt) || !Number.isInteger(row.concurrency) || row.concurrency < 1 || row.concurrency > 64) continue;
      const ageMs = now - row.checkedAt;
      const fresh = ageMs >= -1000 && ageMs <= 30000;
      const measured = Number.isInteger(row.activeJobs) && row.activeJobs >= 0 && row.activeJobs <= row.concurrency;
      const accepting = fresh && row.healthy === true && row.accepting === true;
      workers.push({ id: row.id, checkedAt: row.checkedAt, ageMs: Math.max(0,ageMs), fresh, healthy: fresh && row.healthy === true,
        accepting, concurrency: row.concurrency, occupied: fresh && measured ? row.activeJobs : null,
        available: accepting && measured ? row.concurrency-row.activeJobs : null,
        activeJobs: fresh && Array.isArray(row.jobs) ? row.jobs.slice(0,64).map(job => ({ id: String(job.id).slice(0,80), startedAt: job.startedAt, language: String(job.language || '').slice(0,20), type: String(job.type || '').slice(0,20) })) : [],
        timings: fresh ? row.timings || null : null,
        image: String(row.image || '').slice(0,200), process: fresh ? row.process || null : null, containers: fresh ? row.containers || null : null });
    } catch { /* Invalid telemetry never establishes available capacity. */ }
  }
  const reliable = records.length < 100 && workers.length > 0 && workers.every(w => w.fresh && w.healthy && w.available !== null && w.occupied !== null);
  return { workers, reportedWorkers: workers.length, healthyWorkers: workers.filter(w=>w.healthy).length,
    configuredSlots: workers.filter(w=>w.fresh).reduce((n,w)=>n+w.concurrency,0),
    availableSlots: reliable ? workers.reduce((n,w)=>n+w.available,0) : null,
    occupiedSlots: reliable ? workers.reduce((n,w)=>n+w.occupied,0) : null,
    observedAt: now, capacityStatus: reliable ? 'measured' : 'unknown' };
}

export async function readAnalyticsQueue(queue) {
  const client = await queue.getBackend().client;
  client.defineCommand('coderankAnalyticsWorkersV1', { numberOfKeys:1, lua:`
local result={}
for _, id in ipairs(redis.call('ZREVRANGE', KEYS[1], 0, 99)) do
 local value=redis.call('GET', ARGV[1] .. id)
 if value then result[#result+1]=value end
end
return result` });
  const [records,counts,oldest] = await Promise.all([
    client.runCommand('coderankAnalyticsWorkersV1',['coderank:execution:workers','coderank:execution:worker:']),
    queue.getJobCounts('wait','active','delayed','failed','completed','paused','prioritized'),
    queue.getJobs(['wait'],0,0,true),
  ]);
  return { ...summarizeWorkerRecords(records), queue:{waiting:counts.wait || 0,active:counts.active || 0,delayed:counts.delayed || 0,paused:counts.paused || 0,prioritized:counts.prioritized || 0,
    retainedCompleted:counts.completed || 0,retainedFailed:counts.failed || 0,oldestWaitingMs:oldest[0] ? Math.max(0,Date.now()-oldest[0].timestamp):null} };
}
