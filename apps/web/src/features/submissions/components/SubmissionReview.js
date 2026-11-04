'use client';

export function SubmissionReview({ selectedPracticalId, setSelectedPracticalId, practicals, setExtraTimePractical, studentSearch, setStudentSearch, submissionDivisionFilter, setSubmissionDivisionFilter, submissionStatusFilter, setSubmissionStatusFilter, submissionSortBy, setSubmissionSortBy, submissionSortOrder, setSubmissionSortOrder, loadingSubmissions, submissions, activeCourse, handleViewSubmission, handleDeleteSubmission, submissionCursor, nextSubmissionCursor, fetchSubmissions }) {
  return (<>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '15px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '300px' }}>
              <select
                value={selectedPracticalId}
                onChange={e => setSelectedPracticalId(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'white', minWidth: '200px' }}
              >
                {practicals.map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
                {practicals.length === 0 && <option value="">No practicals available</option>}
              </select>

              {selectedPracticalId && (
                <button
                  type="button"
                  onClick={() => {
                    const found = practicals.find(p => p.id === parseInt(selectedPracticalId));
                    if (found) setExtraTimePractical(found);
                  }}
                  style={{
                    padding: '8px 14px', borderRadius: '6px', border: '1px solid #bfdbfe',
                    backgroundColor: '#eff1ff', color: '#1d4ed8', cursor: 'pointer',
                    fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap'
                  }}
                  title="Add extra time for this practical"
                >
                  ⏰ Grant Extra Time
                </button>
              )}

              <input
                type="text"
                placeholder="Search Student, Roll No, Division..."
                className="input-field"
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
                style={{ maxWidth: '260px', padding: '8px 12px' }}
              />

              <select
                value={submissionDivisionFilter}
                onChange={e => setSubmissionDivisionFilter(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'white', fontSize: '13px' }}
              >
                <option value="all">All Divisions</option>
                {Array.from(new Set(submissions.map(s => s.division).filter(Boolean))).sort().map(div => (
                  <option key={div} value={div}>Div: {div}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <select
                value={submissionStatusFilter}
                onChange={e => setSubmissionStatusFilter(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'white' }}
              >
                <option value="in-time">In-Time Submission</option>
                <option value="late">Late Submission</option>
              </select>

              <select
                value={submissionSortBy}
                onChange={e => setSubmissionSortBy(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'white' }}
              >
                <option value="submission_time">Submission Time</option>
                <option value="marks">Marks</option>
                <option value="student_name">Student Name</option>
              </select>

              <select
                value={submissionSortOrder}
                onChange={e => setSubmissionSortOrder(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'white' }}
              >
                <option value="DESC">Descending</option>
                <option value="ASC">Ascending</option>
              </select>
            </div>
          </div>

          <div className="table-container" style={{ marginTop: '15px' }}>
            {loadingSubmissions ? <p>Loading submissions...</p> : (
              <table>
                <thead>
                  <tr>
                    <th scope="col">Roll Number</th>
                    <th scope="col">Student Name</th>
                    <th scope="col">Division</th>
                    <th scope="col">Submission Time</th>
                    <th scope="col">Language</th>
                    <th scope="col">Status</th>
                    <th scope="col">Raw Score</th>
                    <th scope="col">Normalized Score (Out of 10)</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{s.roll_number || '—'}</td>
                      <td style={{ fontWeight: 500 }}>{s.student_name}</td>
                      <td>
                        <span style={{ fontSize: '12px', fontWeight: 600, backgroundColor: '#eff1ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px' }}>
                          {s.division || '—'}
                        </span>
                      </td>
                      <td>{new Date(s.submitted_at).toLocaleString()}</td>
                      <td>{s.language.toUpperCase()}</td>
                      <td>
                        <span style={{
                          padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                          backgroundColor: s.is_late ? '#fef2f2' : '#eff1ff',
                          color: s.is_late ? '#b91c1c' : '#4f46e5'
                        }}>
                          {s.is_late ? 'Late' : 'In-Time'}
                        </span>
                      </td>
                      <td>{s.raw_marks} Marks</td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{s.normalized_marks} / 10</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            onClick={() => handleViewSubmission(s)}
                            style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', backgroundColor: '#475569', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
                          >
                             View Details
                          </button>
                          {activeCourse?.is_co_coordinator && (
                            <button
                              onClick={() => handleDeleteSubmission(s)}
                              style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', backgroundColor: '#b91c1c', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
                              title="Delete this student submission"
                            >
                               Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {submissions.length === 0 && (
                    <tr><td colSpan="9" style={{ textAlign: 'center', color: '#888', padding: '40px' }}>No student submissions found.</td></tr>
                  )}
                </tbody>
              </table>
            )}
            <div style={{display: 'flex', gap: 12, padding: 16}}>
              <button disabled={loadingSubmissions || !submissionCursor} onClick={() => fetchSubmissions(true, null)}>First page</button>
              <span>{submissions.length} submissions on this page</span>
              <button disabled={loadingSubmissions || !nextSubmissionCursor} onClick={() => fetchSubmissions(true, nextSubmissionCursor)}>Next page</button>
            </div>
          </div>
        </div>

  </>);
}
