import { AsyncLocalStorage } from 'node:async_hooks';

const context = new AsyncLocalStorage();
const phases = new Set(['prepare_compile','execute','harness','persist','cleanup']);
// One context per processor invocation, including retries and concurrent jobs.
export function withExecutionTiming(timing, operation) { return context.run(timing, operation); }
export async function measureExecutionPhase(phase, operation) {
  const timing=context.getStore();
  if(!timing || !phases.has(phase))return operation();
  const start=performance.now();
  try{return await operation();}
  finally{timing[phase]=(timing[phase] ?? 0)+Math.max(0,performance.now()-start);}
}
