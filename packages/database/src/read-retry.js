import {withTimeout} from './timeout.js';

export function transientConnectionError(error) {
  const code = error?.code || error?.sourceError?.code;
  const message = `${error?.message || ''} ${error?.sourceError?.message || ''}`;
  return ['ECONNREFUSED','ECONNRESET','ETIMEDOUT','57P03','08006'].includes(code) || /fetch failed|ECONNREFUSED/.test(message);
}
// Opt-in for caller-reviewed side-effect-free reads only. Never replay writes.
export async function retryRead(operation, {budgetMs = 2500, attempts = 3, delayMs = 250} = {}) {
  if (!Number.isFinite(budgetMs) || budgetMs <= 0 || !Number.isInteger(attempts) || attempts < 1 || attempts > 3) throw Error('Invalid read retry budget');
  const deadline = performance.now() + budgetMs;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const remaining = deadline - performance.now();
    if (remaining <= 0) throw Error('Read deadline exceeded');
    try { return await withTimeout(Promise.resolve().then(() => operation(remaining)), remaining); }
    catch (error) {
      if (attempt + 1 === attempts || !transientConnectionError(error)) throw error;
      const delay = delayMs * (attempt + 1);
      if (performance.now() + delay >= deadline) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
