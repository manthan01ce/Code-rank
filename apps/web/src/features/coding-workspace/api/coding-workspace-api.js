export function workspaceRequest(id, language, options) { return fetch(`/api/student/workspaces/load?practical_id=${id}&language=${language}`, options); }
