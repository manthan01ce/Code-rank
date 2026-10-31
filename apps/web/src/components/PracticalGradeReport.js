'use client';
import { useEffect, useState } from 'react';

export default function PracticalGradeReport({ practical, token, onClose }) {
  const [cursor, setCursor] = useState(null);
  const key = JSON.stringify([practical.id,token,cursor]);
  const [result, setResult] = useState({ key: null, report: null, error: '' });
  const loading = result.key !== key;
  const { report, error } = result;
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ limit: '50' });
    if (cursor) params.set('cursor', cursor);
    (async () => {
      try {
        const response = await fetch(`/api/faculty/practicals/${practical.id}/stats?${params}`, {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw Error(data.error || 'Unable to load grades');
        if (!controller.signal.aborted) setResult({ key, report: data, error: '' });
      } catch (failure) { if (!controller.signal.aborted) setResult({ key, report: null, error: failure.message }); }
    })();
    return () => controller.abort();
  }, [practical.id, token, cursor, key]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Practical grade report" style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,.5)', display: 'grid', placeItems: 'center' }}>
      <section style={{ background: 'var(--card-bg, white)', color: 'var(--text-main, #111)', padding: 24, borderRadius: 12, width: 'min(960px,95vw)', maxHeight: '85vh', overflow: 'auto' }}>
        <button onClick={onClose} autoFocus>Close grades</button>
        <h2>{practical.title} — Grades</h2>
        {error && <p role="alert">{error}</p>}
        {loading ? <p role="status">Loading grade page…</p> : !error && report && <>
          <p>{report.stats.total_students} eligible students · {report.stats.attempted_count} attempted · Average {report.stats.average_marks}</p>
          <button disabled={!cursor} onClick={() => setCursor(null)}>First grade page</button>{' '}
          <button disabled={!report.pagination.nextCursor} onClick={() => setCursor(report.pagination.nextCursor)}>Next grade page</button>
          <table><thead><tr><th>Student</th><th>Roll number</th><th>Marks</th><th>Status</th></tr></thead>
            <tbody>{report.students.map(student => <tr key={student.id}><td>{student.name}</td><td>{student.roll_number}</td><td>{student.normalized_marks}</td><td>{student.status}</td></tr>)}</tbody>
          </table>
          {!report.students.length && <p>No students on this page.</p>}
        </>}
      </section>
    </div>
  );
}
