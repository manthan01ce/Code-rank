import { requestPage } from '../../../lib/client/http-client.js';

export function fetchSubmissionPage(practicalId, token, filters, signal) {
  const params = new URLSearchParams({
    studentSearch: filters.studentSearch, status: filters.status,
    sortBy: filters.sortBy, sortOrder: filters.sortOrder,
  });
  if (filters.division !== 'all') params.set('division', filters.division);
  if (filters.cursor) params.set('cursor', filters.cursor);
  return requestPage(`/api/faculty/practicals/${practicalId}/submissions?${params}`, token, { signal });
}
export function fetchSubmission(id, token, signal) {
  return requestPage(`/api/faculty/submissions/${id}`, token, { signal });
}
export function deleteSubmission(id, token) {
  return requestPage(`/api/faculty/submissions/${id}`, token, { method: 'DELETE' });
}
