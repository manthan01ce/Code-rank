export function selfProfileRequest(options) { return fetch('/api/auth/profile', options); }
export function usernameProfileRequest(username, options) { return fetch(`/api/profile/${encodeURIComponent(username)}`, options); }
