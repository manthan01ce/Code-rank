'use client';
import dynamic from 'next/dynamic';
const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

export function SubmissionDetailDialog({ showSubmissionModal, viewingSubmission, copyCodeSuccess, setCopyCodeSuccess, activeCourse, handleDeleteSubmission, setShowSubmissionModal }) {
  return (<>
      {showSubmissionModal && viewingSubmission && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '32px',
            width: '100%', maxWidth: '850px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            <h3 style={{ marginBottom: '20px', fontSize: '20px', fontWeight: 700 }}>
              Submission Details - {viewingSubmission.student_name}
            </h3>

            <div style={{ display: 'flex', gap: '20px', backgroundColor: '#f8fafc', padding: '15px', borderRadius: '10px', marginBottom: '20px' }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Roll Number: <strong>{viewingSubmission.roll_number || '—'}</strong></p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', mt: '5px' }}>Language: <strong>{(viewingSubmission.language || 'txt').toUpperCase()}</strong></p>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Status: <strong style={{ color: viewingSubmission.status === 'Accepted' ? '#4f46e5' : '#b91c1c' }}>{viewingSubmission.status}</strong></p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', mt: '5px' }}>Submitted: <strong>{new Date(viewingSubmission.submitted_at).toLocaleString()}</strong></p>
              </div>
              <div style={{ flex: 1, textAlign: 'right' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Score:</p>
                <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)' }}>{viewingSubmission.normalized_marks} / 10</p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(Raw Marks: {viewingSubmission.raw_marks} / {viewingSubmission.practical_total_marks})</p>
              </div>
            </div>

            {/* Source code block */}
            <div style={{ marginBottom: '25px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>Submitted Raw Code:</h4>
                  <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#e2e8f0', color: '#334155', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                    {viewingSubmission.language}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    ({viewingSubmission.code ? viewingSubmission.code.split('\n').length : 0} lines)
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (viewingSubmission?.code) {
                        navigator.clipboard.writeText(viewingSubmission.code);
                        setCopyCodeSuccess(true);
                        setTimeout(() => setCopyCodeSuccess(false), 2500);
                      }
                    }}
                    style={{
                      padding: '5px 12px', borderRadius: '6px', border: '1px solid #cbd5e1',
                      backgroundColor: copyCodeSuccess ? '#eff1ff' : '#ffffff',
                      color: copyCodeSuccess ? '#059669' : '#1e293b',
                      fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '5px'
                    }}
                  >
                    {copyCodeSuccess ? '✓ Copied!' : ' Copy Raw Code'}
                  </button>
                </div>
              </div>
              <div style={{ height: '380px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #1e293b' }}><Editor height="100%" language={(viewingSubmission.language || 'txt') === 'c' || (viewingSubmission.language || 'txt') === 'cpp' ? 'cpp' : viewingSubmission.language} theme="light" value={viewingSubmission.code} options={{ readOnly: true, minimap: { enabled: false }, scrollBeyondLastLine: false, fontSize: 13, fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace' }} /></div>
            </div>

            {/* Test case analysis */}
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px' }}>Test Cases evaluation breakdown:</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(viewingSubmission.cases || []).map((c, i) => (
                  <div key={c.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>{c.label || `Test Case ${i + 1}`} {c.is_hidden ? ' (Hidden)' : ''}</span>
                      <span style={{
                        padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                        backgroundColor: c.passed ? '#eff1ff' : '#fef2f2',
                        color: c.passed ? '#4f46e5' : '#b91c1c'
                      }}>
                        {c.passed ? 'PASSED' : 'FAILED'} (+{c.marks_awarded} marks)
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', fontSize: '12px', background: '#f8fafc', padding: '8px', borderRadius: '6px' }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Input:</span>
                        <pre style={{ margin: '3px 0 0 0', fontFamily: 'monospace', background: 'white', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>{c.input}</pre>
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Expected:</span>
                        <pre style={{ margin: '3px 0 0 0', fontFamily: 'monospace', background: 'white', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>{c.expected}</pre>
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Actual Output:</span>
                        <pre style={{
                          margin: '3px 0 0 0', fontFamily: 'monospace', background: 'white', padding: '4px', borderRadius: '4px',
                          border: '1px solid var(--border-color)', color: c.passed ? '#4f46e5' : '#b91c1c'
                        }}>{c.actual_output || '—'}</pre>
                      </div>
                    </div>

                    {c.error_message && (
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#b91c1c', backgroundColor: '#fef2f2', padding: '8px', borderRadius: '6px', fontFamily: 'monospace' }}>
                        <strong>Error output:</strong><br/>
                        {c.error_message}
                      </div>
                    )}
                  </div>
                ))}
                {(!viewingSubmission.cases || viewingSubmission.cases.length === 0) && (
                  <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', color: '#64748b', fontSize: '13px', fontStyle: 'italic', textAlign: 'center' }}>
                    No individual test case evaluation records found for this submission.
                  </div>
                )}
              </div>
            </div>

            {/* Modal action */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
              {activeCourse?.is_co_coordinator ? (
                <button
                  type="button"
                  onClick={() => handleDeleteSubmission(viewingSubmission)}
                  style={{ padding: '10px 18px', backgroundColor: '#b91c1c', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
                >
                   Delete Submission
                </button>
              ) : <div />}
              <button
                onClick={() => setShowSubmissionModal(false)}
                style={{ padding: '10px 24px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                Close Submission Window
              </button>
            </div>
          </div>
        </div>
      )}
  </>);
}
