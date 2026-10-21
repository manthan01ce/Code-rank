export async function readExecutionWorkers(queue, { now = Date.now() } = {}) {
  const client = await queue.getBackend().client;
  client.defineCommand("coderankReadWorkersV1", {
    numberOfKeys: 1,
    lua: `
local result={}
for _, id in ipairs(redis.call('ZRANGEBYSCORE', KEYS[1], ARGV[1], '+inf', 'LIMIT', 0, 100)) do
 local value=redis.call('GET', ARGV[2] .. id)
 if value then result[#result+1]=value end
end
return result
`,
  });
  const records = await client.runCommand("coderankReadWorkersV1", [
    "coderank:execution:workers",
    String(now),
    "coderank:execution:worker:",
  ]);
  let healthyWorkers = 0;
  for (const value of records) {
    try {
      const row = JSON.parse(value);
      if (
        row.healthy === true &&
        Number.isFinite(row.checkedAt) &&
        now - row.checkedAt >= -1000 &&
        now - row.checkedAt <= 30000 &&
        Number.isSafeInteger(row.concurrency) &&
        row.concurrency > 0
      )
        healthyWorkers++;
    } catch {
      /* malformed leases never establish readiness */
    }
  }
  return { healthy: healthyWorkers > 0, healthyWorkers };
}
