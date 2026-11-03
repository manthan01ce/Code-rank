'use client';

import Editor from '@monaco-editor/react';
import { TimelineBadge } from './TimelineBadge';

/**
 * Modal dialog for inspecting practical problem details, test cases, and code templates.
 * @param {Object} props
 * @param {Object} props.practical
 * @param {Object} props.activeCourse
 * @param {number} props.currentTime
 * @param {string} props.codeLang
 * @param {Function} props.onChangeCodeLang (lang) => void
 * @param {Function} props.onClose () => void
 * @param {Function} props.onEdit (practical) => void
 */
export function PracticalDetailModal({
  practical,
  activeCourse,
  currentTime,
  codeLang,
  onChangeCodeLang,
  onClose,
  onEdit,
}) {
  if (!practical) return null;

  const allowedLanguages = practical.starter_code?.allowed_languages || ['python', 'cpp'];

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      overflowY: 'auto', padding: '40px 0'
    }}>
      <div style={{
        background: 'white', borderRadius: '16px', padding: '32px',
        width: '100%', maxWidth: '880px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        maxHeight: '90vh', overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {activeCourse?.course_code || practical.course_code || 'COURSE'}
              </span>
              <span style={{
                padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700,
                backgroundColor: practical.difficulty === 'Easy' ? '#eff1ff' : practical.difficulty === 'Medium' ? '#f1f5f9' : '#fef2f2',
                color: practical.difficulty === 'Easy' ? '#4f46e5' : practical.difficulty === 'Medium' ? '#475569' : '#b91c1c'
              }}>
                {practical.difficulty || 'Easy'}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 600, backgroundColor: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '12px' }}>
                {practical.is_challenge ? '⚡ Challenge Problem' : '📘 Standard Assignment'}
              </span>
              <TimelineBadge startTime={practical.start_time} endTime={practical.end_time} currentTime={currentTime} />
              {!activeCourse?.is_co_coordinator && (
                <span style={{ fontSize: '11px', fontWeight: 600, backgroundColor: '#eff1ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '3px 8px', borderRadius: '12px' }}>
                  👁 View-only Access
                </span>
              )}
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              {practical.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', fontSize: '24px', cursor: 'pointer', color: '#64748b', lineHeight: 1 }}
            title="Close"
          >
            &times;
          </button>
        </div>

        {/* Quick Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Total Marks</span>
            <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary)', margin: '4px 0 0 0' }}>{practical.total_marks} Marks</p>
          </div>
          <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Test Cases</span>
            <p style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', margin: '4px 0 0 0' }}>{practical.test_cases?.length || practical.test_cases_count || 0} Cases</p>
          </div>
          <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Student Submissions</span>
            <p style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', margin: '4px 0 0 0' }}>{practical.submissions_count || 0} Submissions</p>
          </div>
          <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Languages</span>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
              {allowedLanguages.map(l => (
                <span key={l} style={{ fontSize: '10px', fontWeight: 700, backgroundColor: '#e2e8f0', color: '#334155', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                  {l}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Topics & Instructions if present */}
        {practical.topics && (
          <div style={{ marginBottom: '16px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '6px' }}>Topics Covered:</span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {practical.topics.split(',').map((t, idx) => (
                <span key={idx} style={{ fontSize: '12px', backgroundColor: '#eff1ff', color: '#1d4ed8', border: '1px solid #dbeafe', padding: '3px 10px', borderRadius: '12px', fontWeight: 500 }}>
                  #{t.trim()}
                </span>
              ))}
            </div>
          </div>
        )}

        {practical.instructions && (
          <div style={{ marginBottom: '20px', padding: '12px 16px', backgroundColor: '#eff1ff', border: '1px solid #c7d2fe', borderRadius: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Special Instructions for Students:</span>
            <p style={{ fontSize: '13px', color: '#78350f', margin: 0, whiteSpace: 'pre-wrap' }}>{practical.instructions}</p>
          </div>
        )}

        {/* Description / Problem Statement */}
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', marginBottom: '8px', borderLeft: '3px solid var(--primary)', paddingLeft: '8px' }}>
            Problem Description
          </h4>
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13.5px', color: '#334155', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
            {practical.description || 'No description provided.'}
          </div>
        </div>

        {/* Input & Output Format & Constraints */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>Input Format</h4>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12.5px', color: '#334155', whiteSpace: 'pre-wrap', minHeight: '60px' }}>
              {practical.input_format || 'Standard input format.'}
            </div>
          </div>
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>Output Format</h4>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12.5px', color: '#334155', whiteSpace: 'pre-wrap', minHeight: '60px' }}>
              {practical.output_format || 'Standard output format.'}
            </div>
          </div>
          {practical.constraints && (
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>Constraints</h4>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12.5px', color: '#334155', whiteSpace: 'pre-wrap', minHeight: '60px' }}>
                {practical.constraints}
              </div>
            </div>
          )}
        </div>

        {/* Sample Test Cases */}
        {practical.sampleTestCases && practical.sampleTestCases.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', marginBottom: '10px', borderLeft: '3px solid var(--primary)', paddingLeft: '8px' }}>
              Sample Cases
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {practical.sampleTestCases.map((stc, idx) => (
                <div key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Sample {idx + 1}</span>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '6px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Input:</span>
                      <pre style={{ margin: '2px 0 0 0', background: 'white', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', fontFamily: 'monospace' }}>{stc.input || '(empty)'}</pre>
                    </div>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Expected Output:</span>
                      <pre style={{ margin: '2px 0 0 0', background: 'white', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', fontFamily: 'monospace' }}>{stc.expected || '(empty)'}</pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Official Test Cases Evaluation Breakdown */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', margin: 0, borderLeft: '3px solid var(--primary)', paddingLeft: '8px' }}>
              Official Grading Test Cases ({practical.test_cases?.length || 0})
            </h4>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
              Total Evaluation Value: <strong>{practical.total_marks} Marks</strong>
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(practical.test_cases || []).map((tc, idx) => (
              <div key={tc.id || idx} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', backgroundColor: '#ffffff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px' }}>{tc.label || `Test Case ${idx + 1}`}</span>
                    <span style={{
                      fontSize: '11px', fontWeight: 700,
                      backgroundColor: tc.is_hidden ? '#fef2f2' : '#eff1ff',
                      color: tc.is_hidden ? '#b91c1c' : '#4f46e5',
                      padding: '2px 8px', borderRadius: '12px', border: `1px solid ${tc.is_hidden ? '#fecaca' : '#a7f3d0'}`
                    }}>
                      {tc.is_hidden ? '🔒 Hidden Case' : ' Public Case'}
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>
                    +{tc.marks} Marks
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '10px', fontSize: '12px', background: '#f8fafc', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Input:</span>
                    <pre style={{ margin: '3px 0 0 0', fontFamily: 'monospace', background: 'white', padding: '6px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '12px' }}>{tc.input}</pre>
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Expected Output:</span>
                    <pre style={{ margin: '3px 0 0 0', fontFamily: 'monospace', background: 'white', padding: '6px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '12px' }}>{tc.expected}</pre>
                  </div>
                </div>
              </div>
            ))}
            {(!practical.test_cases || practical.test_cases.length === 0) && (
              <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', color: '#64748b', fontSize: '13px', fontStyle: 'italic', textAlign: 'center' }}>
                No test cases configured for this practical yet.
              </div>
            )}
          </div>
        </div>

        {/* Starter Code Templates */}
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', marginBottom: '8px', borderLeft: '3px solid var(--primary)', paddingLeft: '8px' }}>
            Starter Code Templates
          </h4>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
            {allowedLanguages.map(lang => (
              <button
                key={lang}
                type="button"
                onClick={() => onChangeCodeLang(lang)}
                style={{
                  padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border-color)',
                  backgroundColor: codeLang === lang ? 'var(--primary)' : '#ffffff',
                  color: codeLang === lang ? '#ffffff' : '#1e293b',
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase'
                }}
              >
                {lang}
              </button>
            ))}
          </div>
          <div style={{ height: '220px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #1e293b' }}>
            <Editor
              height="100%"
              language={codeLang === 'c' || codeLang === 'cpp' ? 'cpp' : codeLang}
              theme="light"
              value={practical.starter_code?.[codeLang] || (codeLang === 'cpp' ? practical.starter_code?.cpp : practical.starter_code?.python) || '# No template available'}
              options={{ readOnly: true, minimap: { enabled: false }, scrollBeyondLastLine: false, fontSize: 13, fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace' }}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <div>
            {!activeCourse?.is_co_coordinator && (
              <span style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                👁 Read-only View: You have full access to inspect problem statements and grading criteria.
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {activeCourse?.is_co_coordinator && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(practical);
                }}
                style={{ padding: '10px 18px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
              >
                ✏️ Edit Practical
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '10px 24px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: '#ffffff', color: '#1e293b', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
