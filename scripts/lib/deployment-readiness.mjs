export async function checkDeployment(
  baseUrl,
  { fetchImpl = fetch, now = Date.now() } = {},
) {
  const base = new URL(baseUrl);
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password
  ) {
    throw Error("Supply an HTTP(S) deployment URL without credentials");
  }
  const read = async (path) => {
    const response = await fetchImpl(new URL(path, base), {
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
    if (response.status !== 200)
      throw Error(`${path} returned HTTP ${response.status}`);
    if (!/no-store/i.test(response.headers.get("cache-control") || ""))
      throw Error(`${path} permits cached health`);
    return response.json();
  };
  const [live, health] = await Promise.all([
    read("/api/live"),
    read("/api/health"),
  ]);
  if (live.status !== "ok" || health.status !== "healthy")
    throw Error("Deployment is not healthy");
  const checkedAt = Date.parse(health.timestamp);
  if (
    !Number.isFinite(checkedAt) ||
    now - checkedAt > 60000 ||
    checkedAt - now > 5000
  ) {
    throw Error("Health report is stale or has an invalid timestamp");
  }
  for (const name of ["database", "queue", "execution"]) {
    if (health.services?.[name]?.status !== "healthy")
      throw Error(`${name} is not ready`);
  }
  const workers = health.services.execution.healthyWorkers;
  if (!Number.isSafeInteger(workers) || workers < 1)
    throw Error("No healthy execution worker");
  return {
    status: "healthy",
    healthyWorkers: workers,
    checkedAt: health.timestamp,
  };
}
