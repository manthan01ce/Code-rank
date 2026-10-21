export { readExecutionWorkers } from './worker-readiness.js';
import { startOwnerIndexJanitor } from './owner-index.js';
export { sweepOwnerIndexes } from './owner-index.js';
import { Queue, createRedisBackend } from 'bullmq';
import { addStandardJob } from 'bullmq/dist/cjs/scripts/addStandardJob-9.js';

// This adapter is deliberately pinned to BullMQ 6.3.10. Capacity checks and
// insertion execute in ONE Redis script; no leases or check-then-add window.
export function admissionBackend(maxPending, maxPerOwner) {
  for (const value of [maxPending, maxPerOwner]) if (!Number.isSafeInteger(value) || value < 1) throw new Error('Invalid queue capacity');
  return (name, options, context) => {
    const backend = createRedisBackend(name, options, context);
    backend.addStandardJob = async (client, job, encodedOptions, args, keys = backend.keys) => {
      const command = 'coderankAdmitV1';
      client.defineCommand(command, { numberOfKeys: 9, lua: `
local a = cmsgpack.unpack(ARGV[1])
local data = cjson.decode(ARGV[2])
local owner = a[1] .. 'owner:' .. tostring(data.userId)
local pending = redis.call('LLEN', KEYS[1]) + redis.call('LLEN', KEYS[2]) + redis.call('LLEN', KEYS[7]) + redis.call('ZCARD', KEYS[6]) + redis.call('ZCARD', a[1] .. 'prioritized')
if pending >= ${maxPending} then return redis.error_reply('QUEUE_FULL') end
local count = 0
for _, id in ipairs(redis.call('SMEMBERS', owner)) do
  local key = a[1] .. id
  if redis.call('EXISTS', key) == 0 or redis.call('HEXISTS', key, 'finishedOn') == 1 then
    redis.call('SREM', owner, id)
  else count = count + 1 end
end
if count >= ${maxPerOwner} then return redis.error_reply('OWNER_QUEUE_FULL') end
local function insertJob()
${addStandardJob.content}
end
local result = insertJob()
if type(result) == 'string' then redis.call('SADD', owner, result) end
return result
` });
      return client.runCommand(command, backend.addStandardJobArgs(job, encodedOptions, args, keys));
    };
    return backend;
  };
}

export function createExecutionQueue(connection) {
  const queue = new Queue('code-execution', { connection, defaultJobOptions: {
    removeOnComplete: { age: 3600, count: 1000 }, removeOnFail: { age: 86400, count: 1000 }, attempts: 1,
  } }, admissionBackend(Number(process.env.MAX_QUEUE_SIZE || 500), Number(process.env.MAX_JOBS_PER_USER || 5)));
  queue.on('error', error => console.error('Execution queue unavailable:', error.message));
  const stopCleanup = startOwnerIndexJanitor(queue);
  const close = queue.close.bind(queue);
  queue.close = (...args) => { stopCleanup(); return close(...args); };
  return queue;
}
