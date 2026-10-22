export async function fetchUserOptions(url, options) {
  const users = [];
  let cursor = null;
  do {
    const response = await fetch(url + (cursor ? `&cursor=${cursor}` : ''), options);
    if (!response.ok) throw new Error('Unable to load faculty options');
    users.push(...await response.json());
    cursor = response.headers.get('X-Next-Cursor');
  } while (cursor);
  return users;
}
