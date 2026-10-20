// Remove only missing or terminal jobs. Never expire a pending owner's index:
// doing that could bypass admission limits during a long pause/backlog.
const SCRIPT = `
local removed = 0
for _, id in ipairs(redis.call('SMEMBERS', KEYS[1])) do
 local job = ARGV[1] .. id
 if redis.call('EXISTS', job) == 0 or redis.call('HEXISTS', job, 'finishedOn') == 1 then
  removed = removed + redis.call('SREM', KEYS[1], id)
 end
end
return removed
`;
export async function sweepOwnerIndexes(
  queue,
  state = { cursor: "0", pending: [] },
  limit = 100,
) {
  const client = await queue.getBackend().client;
  client.defineCommand("coderankPruneOwnerV1", {
    numberOfKeys: 1,
    lua: SCRIPT,
  });
  const prefix = queue.toKey("");
  if (!state.pending.length) {
    const [cursor, keys] = await client.scan(state.cursor, {
      MATCH: prefix + "owner:*",
      COUNT: limit,
    });
    state.cursor = cursor;
    state.pending.push(...keys);
  }
  let removed = 0;
  for (const key of state.pending.splice(0, limit))
    removed += Number(
      await client.runCommand("coderankPruneOwnerV1", [key, prefix]),
    );
  return { removed, state };
}
export function startOwnerIndexJanitor(queue, { intervalMs = 30000 } = {}) {
  const state = { cursor: "0", pending: [] };
  let running = false,
    stopped = false;
  const tick = async () => {
    if (running || stopped) return;
    running = true;
    try {
      await sweepOwnerIndexes(queue, state);
    } catch (error) {
      console.error("Queue owner cleanup unavailable:", error.message);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  void tick();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
