'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Editor from '@monaco-editor/react';

export default function StudentPracticals() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [practicals, setPracticals] = useState([]);
  const [loading, setLoading] = useState(true);

  // Solving mode states
  const [activePractical, setActivePractical] = useState(null);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [submissionHistory, setSubmissionHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [viewingHistorySub, setViewingHistorySub] = useState(null);

  // Execution states
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState(null);
  const [execError, setExecError] = useState(null);

  const token = () => localStorage.getItem('token');

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
      fetchPracticals();
    } else {
      router.push('/');
    }
  }, []);

  const fetchPracticals = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/student/practicals', {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (res.ok) {
        setPracticals(await res.json());
      }
    } catch (e) {
      console.error('Error fetching practicals:', e);
    } finally {
      setLoading(false);
    }
  };

  const getBoilerplate = (lang) => {
    if (lang === 'python') {
      return `import sys

def main():
    # Read from stdin, write to stdout
    # line = sys.stdin.readline()
    pass

if __name__ == '__main__':
    main()
`;
    } else {
      return `#include <iostream>
using namespace std;

int main() {
    // Read from stdin, write to stdout
    return 0;
}
`;
    }
  };

  const handleStartSolve = (p) => {
    setActivePractical(p);
    setLanguage('python');
    setCode(getBoilerplate('python'));
    setExecResult(null);
    setExecError(null);
    setViewingHistorySub(null);
    fetchSubmissionHistory(p.id);
  };

  const fetchSubmissionHistory = async (practicalId) => {
    setLoadingHistory(true);
    try {
      // Get student submissions for this practical
      const res = await fetch(`/api/faculty/practicals/${practicalId}/submissions?studentSearch=${user.email}`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (res.ok) {
        setSubmissionHistory(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    if (activePractical) {
      setCode(getBoilerplate(lang));
    }
  };

  const handleCodeReset = () => {
    if (activePractical && confirm('Are you sure you want to reset your code to the starter template?')) {
      setCode(getBoilerplate(language));
    }
  };

  const handleRunSubmit = async () => {
    if (!code.trim() || executing) return;
    setExecuting(true);
    setExecResult(null);
    setExecError(null);

    try {
      const res = await fetch(`/api/student/practicals/${activePractical.id}/submit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code, language })
      });

      const data = await res.json();
      if (res.ok) {
        setExecResult(data);
        fetchSubmissionHistory(activePractical.id);
        fetchPracticals(); // update status in list
      } else {
        setExecError(data.error || 'Execution failed.');
      }
    } catch (e) {
      setExecError('Network/Connection error.');
    } finally {
      setExecuting(false);
    }
  };

  const handleViewHistoryDetail = async (subId) => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/faculty/submissions/${subId}`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (res.ok) {
        setViewingHistorySub(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  if (!user) return null;

  // Render coding playground if a practical is selected
  if (activePractical) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '90vh', background: '#0f172a', color: '#f8fafc', margin: '-20px', padding: '15px', fontFamily: 'Inter, sans-serif' }}>
        {/* Playground header bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', pb: '12px', mb: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button
              onClick={() => setActivePractical(null)}
              style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #475569', background: '#1e293b', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
            >
              ← Back to List
            </button>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>{activePractical.title}</h3>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>{activePractical.course_code} • Batch {activePractical.batch_id}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <select
              value={language}
              onChange={e => handleLanguageChange(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #475569', backgroundColor: '#1e293b', color: 'white', fontSize: '13px' }}
            >
              <option value="python">Python</option>
              <option value="cpp">C++</option>
            </select>

            <button
              onClick={handleCodeReset}
              style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #475569', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' }}
            >
              Reset Draft
            </button>

            <button
              onClick={handleRunSubmit}
              disabled={executing}
              style={{ padding: '8px 24px', borderRadius: '6px', border: 'none', backgroundColor: '#4f46e5', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}
            >
              {executing ? 'Executing...' : 'Submit Code →'}
            </button>
          </div>
        </div>

        {/* Dynamic split panes */}
        <div style={{ display: 'flex', flex: 1, gap: '15px', overflow: 'hidden' }}>
          
          {/* Left panel: Problem statement + history */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '15px', overflowY: 'auto', background: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
            
            {/* Toggle tabs for description vs submission history */}
            <div style={{ borderBottom: '1px solid #334155', pb: '10px', mb: '10px' }}>
              <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#38bdf8' }}>Problem Description</h4>
            </div>

            <div style={{ fontSize: '14px', lineHeight: '1.6', color: '#cbd5e1' }} dangerouslySetInnerHTML={{ __html: activePractical.description }} />

            {activePractical.constraints && (
              <div style={{ mt: '15px' }}>
                <h5 style={{ fontWeight: 600, color: '#f1f5f9', mb: '4px' }}>Constraints:</h5>
                <pre style={{ background: '#0f172a', padding: '10px', borderRadius: '6px', fontSize: '13px', fontFamily: 'monospace' }}>{activePractical.constraints}</pre>
              </div>
            )}

            {activePractical.sample_input && (
              <div style={{ mt: '15px', display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <h5 style={{ fontWeight: 600, color: '#f1f5f9', mb: '4px' }}>Sample Input:</h5>
                  <pre style={{ background: '#0f172a', padding: '10px', borderRadius: '6px', fontSize: '13px', fontFamily: 'monospace' }}>{activePractical.sample_input}</pre>
                </div>
                <div style={{ flex: 1 }}>
                  <h5 style={{ fontWeight: 600, color: '#f1f5f9', mb: '4px' }}>Sample Output:</h5>
                  <pre style={{ background: '#0f172a', padding: '10px', borderRadius: '6px', fontSize: '13px', fontFamily: 'monospace' }}>{activePractical.sample_output}</pre>
                </div>
              </div>
            )}

            {/* Submission History Section */}
            <div style={{ marginTop: '30px', borderTop: '1px solid #334155', paddingTop: '20px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#38bdf8', marginBottom: '12px' }}>Your Submission History</h4>
              
              {loadingHistory ? <p style={{ fontSize: '12px', color: '#94a3b8' }}>Loading history...</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {submissionHistory.map(sub => (
                    <div
                      key={sub.id}
                      onClick={() => handleViewHistoryDetail(sub.id)}
                      style={{
                        padding: '10px 12px', borderRadius: '6px', border: '1px solid #475569', background: '#0f172a',
                        cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#1e293b'}
                      onMouseLeave={e => e.currentTarget.style.background = '#0f172a'}
                    >
                      <div style={{ fontSize: '12px' }}>
                        <span style={{ fontWeight: 700, color: sub.status === 'Accepted' ? '#10b981' : '#ef4444' }}>{sub.status}</span>
                        <span style={{ color: '#94a3b8', marginLeft: '10px' }}>{new Date(sub.submitted_at).toLocaleString()}</span>
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 700 }}>
                        {sub.normalized_marks} / 10
                      </div>
                    </div>
                  ))}
                  {submissionHistory.length === 0 && <p style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>No submissions yet.</p>}
                </div>
              )}
            </div>

            {/* Historical Details View */}
            {viewingHistorySub && (
              <div style={{ marginTop: '20px', border: '1px solid #4f46e5', borderRadius: '8px', padding: '15px', background: '#0f172a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', mb: '10px' }}>
                  <h5 style={{ fontWeight: 700 }}>Submission Details</h5>
                  <button onClick={() => setViewingHistorySub(null)} style={{ border: 'none', background: 'none', color: '#ef4444', fontWeight: 'bold', cursor: 'pointer' }}>Close Details</button>
                </div>
                <p style={{ fontSize: '12px', color: '#94a3b8' }}>Status: <strong style={{ color: viewingHistorySub.status === 'Accepted' ? '#10b981' : '#ef4444' }}>{viewingHistorySub.status}</strong></p>
                <p style={{ fontSize: '12px', color: '#94a3b8', mt: '3px' }}>Normalized Grade: <strong>{viewingHistorySub.normalized_marks} / 10</strong></p>
                
                <h6 style={{ fontSize: '11px', fontWeight: 600, mt: '10px', mb: '4px' }}>Submission cases breakdown:</h6>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {viewingHistorySub.cases.map((c, i) => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', borderBottom: '1px solid #334155', pb: '4px' }}>
                      <span>{c.label || `Case ${i + 1}`}</span>
                      <span style={{ color: c.passed ? '#10b981' : '#ef4444', fontWeight: 700 }}>{c.passed ? 'PASS' : 'FAIL'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Right panel: Monaco Editor + console outputs */}
          <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: '15px', overflow: 'hidden' }}>
            
            {/* Editor space */}
            <div style={{ flex: 2, minHeight: 0, borderRadius: '8px', overflow: 'hidden', border: '1px solid #334155' }}>
              <Editor
                height="100%"
                language={language === 'cpp' ? 'cpp' : 'python'}
                theme="vs-dark"
                value={code}
                onChange={val => setCode(val || '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 }
                }}
              />
            </div>

            {/* Test Case Outputs Tray */}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#1e293b', padding: '15px', borderRadius: '8px', border: '1px solid #334155', overflowY: 'auto' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 700, borderBottom: '1px solid #334155', pb: '8px', mb: '10px', color: '#38bdf8' }}>Console / Test Case Results</h4>
              
              {executing && <p style={{ fontSize: '13px', color: '#e2e8f0' }}>Evaluating code against test cases, please wait...</p>}
              
              {execError && <div style={{ color: '#ef4444', fontSize: '13px', fontFamily: 'monospace' }}>Error: {execError}</div>}

              {execResult && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: '12px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: execResult.status === 'Accepted' ? '#10b981' : '#ef4444' }}>
                      Status: {execResult.status}
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: 700 }}>
                      Marks: {execResult.normalized_marks} / 10
                    </span>
                  </div>

                  {execResult.status === 'compile_error' ? (
                    <pre style={{ backgroundColor: '#0f172a', color: '#ef4444', padding: '10px', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace', overflowX: 'auto' }}>
                      {execResult.compileError}
                    </pre>
                  ) : (
                    <p style={{ fontSize: '13px', color: '#94a3b8' }}>Submission evaluated successfully. Review past attempts in the left pane history tray.</p>
                  )}
                </div>
              )}

              {!executing && !execResult && !execError && (
                <p style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>Submit your code to see evaluation results here.</p>
              )}
            </div>

          </div>

        </div>
      </div>
    );
  }

  // Render list of active practicals
  return (
    <div style={{ padding: '20px', fontFamily: 'Inter, sans-serif' }}>
      <div className="header" style={{ marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Assigned Coding Practicals</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Solve your coding assignments and view marks feedback.</p>
        </div>
      </div>

      <div className="table-container">
        {loading ? (
          <p>Loading assigned practicals...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Practical Title</th>
                <th>Course</th>
                <th>Difficulty</th>
                <th>Type</th>
                <th>Grading Score</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {practicals.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{p.title}</td>
                  <td>{p.course_code} - {p.course_name}</td>
                  <td>
                    <span style={{
                      padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                      backgroundColor: p.difficulty === 'Easy' ? '#ecfdf5' : p.difficulty === 'Medium' ? '#fef3c7' : '#fef2f2',
                      color: p.difficulty === 'Easy' ? '#10b981' : p.difficulty === 'Medium' ? '#f59e0b' : '#ef4444'
                    }}>
                      {p.difficulty}
                    </span>
                  </td>
                  <td>{p.is_challenge ? '🏆 Challenge' : '📘 Standard'}</td>
                  <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                    {p.my_marks !== null ? `${p.my_marks} / 10` : '—'}
                  </td>
                  <td>
                    <span style={{
                      padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                      backgroundColor: p.my_status === 'Accepted' ? '#ecfdf5' : p.my_status ? '#fef2f2' : '#f1f5f9',
                      color: p.my_status === 'Accepted' ? '#10b981' : p.my_status ? '#ef4444' : '#64748b'
                    }}>
                      {p.my_status || 'Unattempted'}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => handleStartSolve(p)}
                      style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#4f46e5', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}
                    >
                      {p.my_status ? '🔄 Re-solve' : '🚀 Start Solve'}
                    </button>
                  </td>
                </tr>
              ))}
              {practicals.length === 0 && (
                <tr><td colSpan="7" style={{ textAlign: 'center', color: '#888', padding: '40px' }}>No coding practicals assigned to your batch currently.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
