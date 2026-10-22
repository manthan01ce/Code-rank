/**
 * packages/core/src/utils/timeout.js — Timeout wrapper utility
 * -------------------------------------------------------------
 * Wraps async operations with configurable timeout to prevent hanging requests.
 * Optionally returns a fallback value instead of throwing on timeout.
 */

/**
 * Wraps a promise with a timeout mechanism
 * @param {Promise} promise - The promise to wrap
 * @param {number} timeoutMs - Timeout duration in milliseconds
 * @param {*} [fallbackValue] - Optional fallback value to return on timeout instead of throwing
 * @returns {Promise} - Resolves with promise result or fallback, rejects on timeout if no fallback
 * @throws {Error} - Throws timeout error if no fallback value provided
 */
export async function withTimeout(promise, timeoutMs, fallbackValue) {
  const hasFallback = arguments.length === 3;
  
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((resolve, reject) => {
        timer = setTimeout(() => {
          if (hasFallback) resolve(fallbackValue);
          else reject(new Error(`Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally { clearTimeout(timer); }
}

export default withTimeout;
