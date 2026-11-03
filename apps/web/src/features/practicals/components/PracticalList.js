'use client';

import { TimelineBadge } from './TimelineBadge';

/**
 * Table view of course practicals with administrative action buttons.
 * @param {Object} props
 * @param {Array} props.practicals
 * @param {boolean} props.loading
 * @param {Object|null} props.activeCourse
 * @param {number} props.currentTime
 * @param {Function} props.onAddPractical
 * @param {Function} props.onViewPractical
 * @param {Function} props.onEditPractical
 * @param {Function} props.onDeletePractical
 * @param {Function} props.onExtraTime
 * @param {Function} props.onGrades
 */
export function PracticalList({
  practicals,
  loading,
  activeCourse,
  currentTime,
  onAddPractical,
  onViewPractical,
  onEditPractical,
  onDeletePractical,
  onExtraTime,
  onGrades,
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Available Practicals</h3>
        {activeCourse?.is_co_coordinator && (
          <button className="btn-primary" style={{ width: 'auto', padding: '10px 20px', margin: 0 }} onClick={onAddPractical}>
            + Add Practical
          </button>
        )}
      </div>

      <div className="table-container" style={{ marginTop: '15px' }}>
        {loading ? <p>Loading practicals...</p> : (
          <table>
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Difficulty</th>
                <th scope="col">Type</th>
                <th scope="col">Timeline</th>
                <th scope="col">Total Marks (Internal)</th>
                <th scope="col">Test Cases</th>
                <th scope="col">Submissions</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {practicals.map(p => (
                <tr key={p.id}>
                  <td
                    style={{ fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}
                    onClick={() => onViewPractical(p)}
                    title="Click to view practical details"
                  >
                    <span style={{ textDecoration: 'underline', textUnderlineOffset: '3px' }}>{p.title}</span>
                  </td>
                  <td>
                    <span style={{
                      padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                      backgroundColor: p.difficulty === 'Easy' ? '#eff1ff' : p.difficulty === 'Medium' ? '#f1f5f9' : '#fef2f2',
                      color: p.difficulty === 'Easy' ? '#4f46e5' : p.difficulty === 'Medium' ? '#475569' : '#b91c1c'
                    }}>
                      {p.difficulty}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{p.is_challenge ? '⚡ Challenge' : '📘 Standard'}</td>
                  <td>
                    <TimelineBadge startTime={p.start_time} endTime={p.end_time} currentTime={currentTime} />
                  </td>
                  <td>{p.total_marks} Marks</td>
                  <td>{p.test_cases_count} cases</td>
                  <td>{p.submissions_count} attempts</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button onClick={() => onGrades(p)}>Grades</button>
                      <button
                        onClick={() => onExtraTime(p)}
                        style={{
                          padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1',
                          backgroundColor: '#f8fafc', color: '#1e293b', cursor: 'pointer',
                          fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px'
                        }}
                        title="Add extra time for solving this practical"
                      >
                        ⏰ + Time
                      </button>

                      <button
                        onClick={() => onViewPractical(p)}
                        style={{
                          padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1',
                          backgroundColor: '#ffffff', color: '#1e293b', cursor: 'pointer',
                          fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px'
                        }}
                        title="View practical details"
                      >
                        👁 Details
                      </button>

                      {activeCourse?.is_co_coordinator ? (
                        <>
                          <button
                            onClick={() => onEditPractical(p)}
                            style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--primary)', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => onDeletePractical(p)}
                            style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', backgroundColor: '#b91c1c', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
                          >
                            🗑️ Delete
                          </button>
                        </>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#64748b', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', padding: '3px 8px', borderRadius: '10px', fontStyle: 'italic' }}>
                          View-only
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {practicals.length === 0 && (
                <tr><td colSpan="8" style={{ textAlign: 'center', color: '#888', padding: '40px' }}>No practicals found. Create one to get started.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
