/**
 * Request coalescing to prevent thundering herd on cache misses.
 * When multiple concurrent requests ask for the same key, only one
 * fetch executes, and all waiters receive the same result.
 */

const pendingRequests = new Map();

/**
 * Coalesce concurrent requests for the same key
 * @param {string} key - Unique identifier for the request
 * @param {Function} fetchFn - Async function to fetch data on cache miss
 * @returns {Promise<any>} The fetched data
 */
export async function coalesce(key, fetchFn) {
  // If there's already a pending request for this key, wait for it
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key);
  }

  // Create a new promise for this request
  const promise = (async () => {
    try {
      const result = await fetchFn();
      return result;
    } finally {
      // Clean up after request completes (success or failure)
      pendingRequests.delete(key);
    }
  })();

  // Store the promise so concurrent requests can share it
  pendingRequests.set(key, promise);
  return promise;
}
