/**
 * apps/web/src/lib/api-utils.js
 * Client-side API fetch helper attaching Authorization token automatically
 */
import { getClientAuth } from './auth-client.js';

export async function fetchApi(url, options = {}) {
  const { token } = getClientAuth();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || `Request failed with status ${response.status}`);
  }

  return data;
}
