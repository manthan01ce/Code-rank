/** Own the entire response deadline, including body consumption. No automatic login replay. */
export async function signInRequest(credentials, {fetchImpl = fetch, timeoutMs = 12000, signal} = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, {once: true});
  const timer = setTimeout(() => controller.abort(new Error('Sign-in response timed out. It may have completed; please try again once.')), timeoutMs);
  try {
    const response = await fetchImpl('/api/auth/login', {method: 'POST', signal: controller.signal,
      headers: {'Content-Type': 'application/json'}, body: JSON.stringify(credentials)});
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 503) throw new Error('Sign-in service is temporarily unavailable. Please try again shortly.');
      if (response.status === 429) throw new Error(`Too many sign-in attempts. Please retry in ${response.headers.get('Retry-After') || 60} seconds.`);
      throw new Error(data.error || 'Sign-in failed. Please try again.');
    }
    return data;
  } finally {clearTimeout(timer);signal?.removeEventListener('abort', abort);}
}
