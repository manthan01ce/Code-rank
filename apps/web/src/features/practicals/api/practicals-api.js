import { fetchCollection } from '../../../lib/client/fetch-collection.js';

/**
 * Fetch all practicals for a given course.
 * @param {string|number} courseId
 * @param {string} token Bearer auth token
 * @returns {Promise<Array>}
 */
export async function fetchCoursePracticals(courseId, token) {
  return fetchCollection(`/api/faculty/practicals?course_id=${encodeURIComponent(courseId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Fetch complete details of a practical by ID.
 * @param {string|number} practicalId
 * @param {string} token Bearer auth token
 * @returns {Promise<Object>}
 */
export async function fetchPracticalDetails(practicalId, token) {
  const res = await fetch(`/api/faculty/practicals/${encodeURIComponent(practicalId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to retrieve practical details.');
  }
  return res.json();
}

/**
 * Create a new practical.
 * @param {Object} payload
 * @param {string} token Bearer auth token
 * @returns {Promise<Object>}
 */
export async function createPractical(payload, token) {
  const res = await fetch('/api/faculty/practicals', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create practical.');
  }
  return data;
}

/**
 * Update an existing practical.
 * @param {string|number} practicalId
 * @param {Object} payload
 * @param {string} token Bearer auth token
 * @returns {Promise<Object>}
 */
export async function updatePractical(practicalId, payload, token) {
  const res = await fetch(`/api/faculty/practicals/${encodeURIComponent(practicalId)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update practical.');
  }
  return data;
}

/**
 * Delete or deactivate a practical.
 * @param {string|number} practicalId
 * @param {string} token Bearer auth token
 * @returns {Promise<Object>}
 */
export async function deletePractical(practicalId, token) {
  const res = await fetch(`/api/faculty/practicals/${encodeURIComponent(practicalId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to delete practical.');
  }
  return data;
}

/**
 * Grant extra time for a practical.
 * @param {string|number} practicalId
 * @param {Object} payload { extraMinutes } or { newEndTime }
 * @param {string} token Bearer auth token
 * @returns {Promise<Object>}
 */
export async function grantExtraTime(practicalId, payload, token) {
  const res = await fetch(`/api/faculty/practicals/${encodeURIComponent(practicalId)}/extra-time`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to grant extra time.');
  }
  return data;
}
