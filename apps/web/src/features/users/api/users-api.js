/** Public user endpoints only; authorization and field validation stay in API. */
export function userRequest(id, options) {
  return fetch(id == null ? '/api/users' : `/api/users/${id}`, options);
}
export function userListRequest(url, options) {
  return fetch(url, options);
}
export function uploadUsers(file, role, token) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('role', role);
  return fetch('/api/users/bulk', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
  });
}

/** Invalidate late results even when a transport does not honor abort. */
export function createUserListLifecycle() {
  const requestVersion = { current: 0 };
  const activeAbortController = { current: null };
  return {
    requestVersion, activeAbortController,
    cancel() { requestVersion.current += 1; activeAbortController.current?.abort(); },
  };
}
