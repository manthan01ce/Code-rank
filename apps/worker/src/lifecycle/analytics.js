import { readSandboxContainers } from '@coderank/runner/sandbox';

export function trackWorkerExecutions(worker) {
  const jobs = new Map();
  const active = job => jobs.set(String(job.id), { id:String(job.id), startedAt:Date.now(), language:job.data?.payload?.language || '', type:job.data?.type || '' });
  const finished = job => { if(job) jobs.delete(String(job.id)); };
  worker.on('active',active);
  worker.on('completed',finished);
  worker.on('failed',finished);
  let previousCpu=process.cpuUsage(), previousTime=Date.now();
  return {
    async observe() {
      const now=Date.now(), elapsed=Math.max(1,now-previousTime), cpu=process.cpuUsage(previousCpu);
      previousCpu=process.cpuUsage(); previousTime=now;
      let memory;
      try { memory=process.memoryUsage(); } catch { memory={rss:null,heapUsed:null}; }
      return { accepting:worker.isRunning() && !worker.isPaused(), activeJobs:jobs.size, jobs:[...jobs.values()].slice(0,64),
        process:{uptimeSeconds:Math.floor(process.uptime()),rssBytes:memory.rss,heapUsedBytes:memory.heapUsed,cpuPercentOfOneCore:Math.round((cpu.user+cpu.system)/elapsed/10*100)/100},
        containers:await readSandboxContainers() };
    },
    stop() { worker.off('active',active); worker.off('completed',finished); worker.off('failed',finished); },
  };
}
