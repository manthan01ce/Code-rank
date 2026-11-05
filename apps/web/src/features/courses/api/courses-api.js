export function courseRequest(id, options) { return fetch(id == null ? '/api/courses' : `/api/courses/${id}`, options); }
export function departmentRequest(id, options) { return fetch(id == null ? '/api/departments' : `/api/departments/${id}`, options); }
