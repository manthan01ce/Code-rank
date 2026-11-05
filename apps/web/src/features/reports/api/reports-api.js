import { requestPage } from '../../../lib/client/http-client.js';

export function fetchMarksPage(courseId, token, { studentCursor, practicalCursor, department }, signal) {
  const params = new URLSearchParams();
  if (studentCursor) params.set('studentCursor', studentCursor);
  if (practicalCursor) params.set('practicalCursor', practicalCursor);
  if (department !== 'all') params.set('department', department);
  return requestPage(`/api/faculty/courses/${courseId}/stats?${params}`, token, { signal });
}
export function fetchGradePage(practicalId, token, cursor, signal) {
  const params = new URLSearchParams({ limit: '50' });
  if (cursor) params.set('cursor', cursor);
  return requestPage(`/api/faculty/practicals/${practicalId}/stats?${params}`, token, { signal });
}
