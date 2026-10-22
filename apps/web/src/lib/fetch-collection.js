// Small selector collections can span bounded API pages. Large tables use page UI.
export async function fetchCollection(url, options = {}) {
  const rows = [],
    seen = new Set();
  let cursor = null;
  do {
    const page =
      url +
      (cursor
        ? `${url.includes("?") ? "&" : "?"}cursor=${encodeURIComponent(cursor)}`
        : "");
    const response = await fetch(page, options);
    if (!response.ok) {
      if (response.status === 401) {
        if (typeof window !== 'undefined') {
          const hasToken = !!localStorage.getItem('token');
          if (!hasToken) {
            localStorage.removeItem('user');
            window.location.replace('/login');
          }
        }
        throw Error('Session expired or unauthorized. Please log in again.');
      }
      throw Error(`Collection request failed (${response.status})`);
    }
    const data = await response.json();
    if (!Array.isArray(data)) throw Error("Invalid collection response");
    rows.push(...data);
    cursor = response.headers.get("X-Next-Cursor");
    if (cursor && seen.has(cursor)) throw Error("Repeated collection cursor");
    if (cursor) seen.add(cursor);
  } while (cursor);
  return rows;
}
