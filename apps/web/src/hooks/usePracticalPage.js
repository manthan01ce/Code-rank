'use client';
import { useCallback, useEffect, useState } from 'react';

// Each page/filter change aborts its predecessor; late responses cannot replace
// a newly selected course. Refresh retains the current bounded page.
export function usePracticalPage(courseId = null, enabled = true) {
  const [position, setPosition] = useState({ courseId, cursor: null });
  const cursor = position.courseId === courseId ? position.cursor : null;
  const [revision, setRevision] = useState(0);
  const requestKey = JSON.stringify([courseId,cursor,enabled,revision]);
  const [result, setResult] = useState({ key: null, rows: [], next: null, error: '' });
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ limit: '25' });
    if (courseId) params.set('course_id', courseId);
    if (cursor) params.set('cursor', cursor);
    (async () => {
      try {
        const response = await fetch(`/api/student/practicals?${params}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }, signal: controller.signal,
        });
        const rows = await response.json();
        if (!response.ok || !Array.isArray(rows)) throw Error(rows?.error || 'Unable to load practicals');
        if (!controller.signal.aborted) setResult({ key: requestKey, rows, next: response.headers.get('X-Next-Cursor') || null, error: '' });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ key: requestKey, rows: [], next: null, error: error.message });
      }
    })();
    return () => controller.abort();
  }, [courseId, cursor, enabled, requestKey]);
  const current = result.key === requestKey;
  return { rows: current ? result.rows : [], next: current ? result.next : null, error: current ? result.error : '', loading: enabled && !current, cursor, refresh,
    first: () => { setPosition({ courseId, cursor: null }); refresh(); },
    nextPage: () => { if (current && result.next) setPosition({ courseId, cursor: result.next }); },
  };
}
