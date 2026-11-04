'use client';

export function MarksOverview({ statsData, selectedDepartmentFilter, setSelectedDepartmentFilter, handleExportCSV, loadingStats, statsStudentCursor, statsPracticalCursor, fetchStats }) {
  return (<>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '15px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Grades Matrix (Pivot View)</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Grid layout showing each student's score across all active course practicals.</p>
            </div>

            {statsData && (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Department:</label>
                  <select
                    value={selectedDepartmentFilter}
                    onChange={e => setSelectedDepartmentFilter(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'white', fontSize: '13px', fontWeight: 600 }}
                  >
                    <option value="all">All Departments</option>
                    {(statsData.departments || []).filter(d => d.department).map(d => (
                      <option key={d.department} value={d.department}>{d.department} ({d.count})</option>
                    ))}
                  </select>
                </div>

                <button
                  className="btn-primary"
                  style={{ width: 'auto', padding: '10px 18px', backgroundColor: '#4f46e5', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={handleExportCSV}
                >
                  ⬆ Export Current Page (CSV)
                </button>
              </div>
            )}
          </div>

          {loadingStats ? <p>Loading marks matrix...</p> : statsData && statsData.practicals && (() => {
            const marks = new Map(statsData.submissions.map(s => [`${s.student_id}:${s.practical_id}`, s]));
            const filteredStatsStudents = (statsData.students || []).filter(s => {
              if (selectedDepartmentFilter === 'all') return true;
              return (s.department || '').toUpperCase() === selectedDepartmentFilter.toUpperCase();
            });

            return (
              <div>
                <div style={{display: 'flex', gap: 12, flexWrap: 'wrap'}}>
                  <button disabled={!statsStudentCursor} onClick={() => fetchStats(true, null, statsPracticalCursor)}>First student page</button>
                  <button disabled={!statsData.pagination?.studentCursor} onClick={() => fetchStats(true, statsData.pagination.studentCursor, statsPracticalCursor)}>Next students</button>
                  <button disabled={!statsPracticalCursor} onClick={() => fetchStats(true, statsStudentCursor, null)}>First practical page</button>
                  <button disabled={!statsData.pagination?.practicalCursor} onClick={() => fetchStats(true, statsStudentCursor, statsData.pagination.practicalCursor)}>Next practicals</button>
                  <span>{statsData.students.length} students × {statsData.practicals.length} practicals on this page</span>
                </div>
                <div className="table-container" style={{ overflowX: 'auto', marginTop: '15px' }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ minWidth: '120px' }}>Roll Number</th>
                        <th style={{ minWidth: '170px' }}>Student Name</th>
                        <th style={{ minWidth: '110px' }}>Department</th>
                        <th style={{ minWidth: '90px' }}>Division</th>
                        {statsData.practicals.map((p, idx) => (
                          <th key={p.id} style={{ textAlign: 'center', minWidth: '120px' }}>
                            Prac {idx + 1}
                            <div style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--text-muted)', marginTop: '4px' }}>
                              {p.title.length > 20 ? p.title.substring(0, 18) + '..' : p.title}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStatsStudents.map(s => (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{s.roll_number || '—'}</td>
                          <td style={{ fontWeight: 500 }}>{s.name}</td>
                          <td>
                            <span style={{ fontSize: '12px', fontWeight: 600, backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>
                              {s.department || '—'}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: '12px', fontWeight: 600, backgroundColor: '#eff1ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px' }}>
                              {s.division || '—'}
                            </span>
                          </td>
                          {statsData.practicals.map(p => {
                            const sub = marks.get(`${s.id}:${p.id}`);
                            return (
                              <td key={p.id} style={{ textAlign: 'center' }}>
                                {sub ? (
                                  <div>
                                    <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{sub.normalized_marks} / 10</span>
                                    {sub.is_late && (
                                      <span style={{
                                        display: 'block', fontSize: '9px', fontWeight: 'bold', color: '#b91c1c', marginTop: '2px'
                                      }}>
                                        LATE
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic' }}>Not Submitted</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {filteredStatsStudents.length === 0 && (
                        <tr>
                          <td colSpan={statsData.practicals.length + 4} style={{ textAlign: 'center', color: '#888', padding: '40px' }}>
                            No students found for department "{selectedDepartmentFilter}".
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>

  </>);
}
