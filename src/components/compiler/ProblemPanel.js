'use client';

/**
 * PURPOSE OF THIS FILE:
 * Left panel component within the student coding workspace.
 * It renders tabs:
 * - DESCRIPTION: Renders challenge difficulty, problem statement text, formatting specifications
 *   (input/output formats, sample test cases), and constraint blocks.
 * - SUBMISSIONS: Fetches and lists the student's solution log history specifically for
 *   this active practical task (status, raw/normalized scores, language, and timestamp).
 */

import { useState, useEffect } from 'react';
import { AlignLeft, Lightbulb, MessageSquare, Clock } from 'lucide-react';

const STATIC_PROBLEM = {
  id: 1,
  title: '1. Two Sum',
  difficulty: 'Easy',
  description:
    'Given an array of integers <code>nums</code> and an integer <code>target</code>, return ' +
    '<em>indices of the two numbers such that they add up to <code>target</code></em>.<br/><br/>' +
    'You may assume that each input would have <strong>exactly one solution</strong>, and you ' +
    'may not use the same element twice.<br/><br/>' +
    'You can return the answer in any order.',
  examples: [
    { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].' },
    { input: 'nums = [3,2,4], target = 6', output: '[1,2]' },
    { input: 'nums = [3,3], target = 6', output: '[0,1]' },
  ],
  constraints: [
    '2 ≤ nums.length ≤ 10⁴',
    '-10⁹ ≤ nums[i] ≤ 10⁹',
    '-10⁹ ≤ target ≤ 10⁹',
    'Only one valid answer exists.',
  ],
};

const DIFFICULTY_COLORS = {
  Easy:   { color: '#0fa336', bg: 'rgba(15,163,54,0.1)',   border: 'rgba(15,163,54,0.3)' },
  Medium: { color: '#f4b400', bg: 'rgba(244,180,0,0.1)',  border: 'rgba(244,180,0,0.3)' },
  Hard:   { color: '#e22718', bg: 'rgba(226,39,24,0.1)',  border: 'rgba(226,39,24,0.3)' },
};

const TABS = [
  { id: 'description', icon: <AlignLeft size={13} />,     label: 'DESCRIPTION' },
  { id: 'submissions', icon: <Clock size={13} />,         label: 'SUBMISSIONS' }
];

export default function ProblemPanel({ problem }) {
  const [activeTab, setActiveTab] = useState('description');
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'submissions' && problem?.dbId) {
      setLoading(true);
      const token = localStorage.getItem('token');
      fetch(`/api/student/practicals/${problem.dbId}/submissions`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setSubmissions(data);
        })
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [activeTab, problem?.dbId]);

  const p = problem ?? STATIC_PROBLEM;
  const diff = DIFFICULTY_COLORS[p.difficulty] ?? DIFFICULTY_COLORS.Easy;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0d0d0d', fontFamily: 'Inter, sans-serif', color: '#bbbbbb' }}>

      {/* Tab Bar */}
      <div style={{ display: 'flex', alignItems: 'flex-end', background: '#000000', borderBottom: '1px solid #262626', padding: '0 20px', flexShrink: 0, overflowX: 'auto' }}>
        {TABS.map(({ id, icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === id ? '2px solid #ffffff' : '2px solid transparent',
              color: activeTab === id ? '#ffffff' : '#7e7e7e',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              padding: '14px 16px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
            }}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 24px' }}>
        {activeTab === 'description' && (
          <div style={{ maxWidth: '680px' }}>
            {/* Problem number + title */}
            <h1 style={{ color: '#ffffff', fontSize: '22px', fontWeight: 700, marginBottom: '16px', lineHeight: 1.2 }}>{p.title}</h1>

            {/* Difficulty + tags */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
              <span style={{ color: diff.color, background: diff.bg, border: `1px solid ${diff.border}`, fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', padding: '3px 10px' }}>
                {p.difficulty}
              </span>
              <button style={{ background: '#1a1a1a', border: '1px solid #262626', color: '#7e7e7e', fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', padding: '3px 10px', cursor: 'pointer' }}>Topics</button>
              <button style={{ background: '#1a1a1a', border: '1px solid #262626', color: '#7e7e7e', fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', padding: '3px 10px', cursor: 'pointer' }}>Companies</button>
            </div>

            {/* Description */}
            <div
              style={{ fontSize: '15px', fontWeight: 300, lineHeight: 1.7, color: '#bbbbbb', marginBottom: '32px' }}
              dangerouslySetInnerHTML={{ __html: p.description }}
            />

            {/* Examples */}
            {/* Examples (Static Problems) */}
            {!p.isPractical && p.examples && p.examples.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
                {p.examples.map((ex, i) => (
                  <div key={i}>
                    <p style={{ color: '#e6e6e6', fontWeight: 700, fontSize: '13px', marginBottom: '8px', letterSpacing: '0.5px' }}>Example {i + 1}:</p>
                    <div style={{ background: '#1a1a1a', borderLeft: '3px solid #0066b1', padding: '14px 16px', fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace', fontSize: '13px' }}>
                      <div style={{ marginBottom: '4px' }}><span style={{ color: '#7e7e7e' }}>Input: </span><span style={{ color: '#e6e6e6' }}>{ex.input}</span></div>
                      <div style={{ marginBottom: ex.explanation ? '4px' : 0 }}><span style={{ color: '#7e7e7e' }}>Output: </span><span style={{ color: '#e6e6e6' }}>{ex.output}</span></div>
                      {ex.explanation && <div><span style={{ color: '#7e7e7e' }}>Explanation: </span><span style={{ color: '#e6e6e6' }}>{ex.explanation}</span></div>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Dynamic Practicals Format Specifier Block */}
            {p.isPractical && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
                {p.inputFormat && (
                  <div>
                    <p style={{ color: '#e6e6e6', fontWeight: 700, fontSize: '13px', marginBottom: '8px', letterSpacing: '0.5px' }}>Input Format:</p>
                    <div style={{ background: '#1a1a1a', borderLeft: '3px solid #00b8a3', padding: '14px 16px', fontSize: '13px', color: '#bbbbbb', whiteSpace: 'pre-wrap' }}>
                      {p.inputFormat}
                    </div>
                  </div>
                )}
                {p.outputFormat && (
                  <div>
                    <p style={{ color: '#e6e6e6', fontWeight: 700, fontSize: '13px', marginBottom: '8px', letterSpacing: '0.5px' }}>Output Format:</p>
                    <div style={{ background: '#1a1a1a', borderLeft: '3px solid #00b8a3', padding: '14px 16px', fontSize: '13px', color: '#bbbbbb', whiteSpace: 'pre-wrap' }}>
                      {p.outputFormat}
                    </div>
                  </div>
                )}
                {p.sampleInput && (
                  <div>
                    <p style={{ color: '#e6e6e6', fontWeight: 700, fontSize: '13px', marginBottom: '8px', letterSpacing: '0.5px' }}>Sample Input:</p>
                    <pre style={{ background: '#1a1a1a', border: '1px solid #262626', padding: '14px 16px', fontFamily: 'monospace', fontSize: '13px', color: '#e6e6e6', overflowX: 'auto', margin: 0, whiteSpace: 'pre-wrap' }}>
                      {p.sampleInput}
                    </pre>
                  </div>
                )}
                {p.sampleOutput && (
                  <div>
                    <p style={{ color: '#e6e6e6', fontWeight: 700, fontSize: '13px', marginBottom: '8px', letterSpacing: '0.5px' }}>Sample Output:</p>
                    <pre style={{ background: '#1a1a1a', border: '1px solid #262626', padding: '14px 16px', fontFamily: 'monospace', fontSize: '13px', color: '#e6e6e6', overflowX: 'auto', margin: 0, whiteSpace: 'pre-wrap' }}>
                      {p.sampleOutput}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Constraints (Static Problems) */}
            {!p.isPractical && p.constraints && p.constraints.length > 0 && (
              <div>
                <p style={{ color: '#e6e6e6', fontWeight: 700, fontSize: '13px', marginBottom: '12px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Constraints</p>
                <div style={{ background: '#1a1a1a', border: '1px solid #262626', padding: '16px' }}>
                  {p.constraints.map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: i < p.constraints.length - 1 ? '8px' : 0, fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace', fontSize: '13px', color: '#bbbbbb' }}>
                      <span style={{ color: '#0066b1', flexShrink: 0, marginTop: '1px' }}>›</span>
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Constraints (Dynamic Practicals) */}
            {p.isPractical && p.constraints && (
              <div>
                <p style={{ color: '#e6e6e6', fontWeight: 700, fontSize: '13px', marginBottom: '12px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Constraints</p>
                <div style={{ background: '#1a1a1a', border: '1px solid #262626', padding: '16px', fontSize: '13px', color: '#bbbbbb', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                  {p.constraints}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'submissions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>Your Submission History</h3>
            
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '30px', color: '#7e7e7e', fontSize: '13px' }}>
                Loading submissions...
              </div>
            ) : submissions.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#5e5e5e', fontSize: '13px', background: '#111', borderRadius: '6px' }}>
                No submissions found for this practical. Solve and submit!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {submissions.map((sub) => {
                  const isSuccess = sub.status === 'success' || sub.status === 'Passed';
                  return (
                    <div key={sub.id} style={{ backgroundColor: '#141414', border: '1px solid #222', borderRadius: '8px', padding: '15px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#888', textTransform: 'uppercase' }}>{sub.language}</span>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: isSuccess ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                          color: isSuccess ? '#10b981' : '#ef4444',
                        }}>
                          {sub.status.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#ccc', marginBottom: '4px' }}>
                        <span>Raw Score: <strong style={{ color: '#fff' }}>{sub.raw_marks}</strong></span>
                        <span>Normalized: <strong style={{ color: '#10b981' }}>{sub.normalized_marks} / 10</strong></span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#555', textAlign: 'right' }}>
                        {new Date(sub.submitted_at).toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
