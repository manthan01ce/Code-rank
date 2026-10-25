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
import { useSocket } from '@/hooks/useSocket';

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

export default function ProblemPanel({ problem, onLoadSubmissionCode }) {
  const [activeTab, setActiveTab] = useState('description');
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [extraTimeAlert, setExtraTimeAlert] = useState(null);

  const socket = useSocket();

  // Timeline state
  const [currentStartTime, setCurrentStartTime] = useState(problem?.startTime || null);
  const [currentEndTime, setCurrentEndTime] = useState(problem?.endTime || null);
  const [countdownStr, setCountdownStr] = useState('');
  const [isExpired, setIsExpired] = useState(false);
  const [isUpcoming, setIsUpcoming] = useState(false);

  useEffect(() => {
    setCurrentStartTime(problem?.startTime || null);
    setCurrentEndTime(problem?.endTime || null);
  }, [problem?.startTime, problem?.endTime]);

  // Real-time listener for timeline extensions / extra time
  useEffect(() => {
    if (!socket || !problem?.dbId) return;

    const handlePracticalUpdated = (updated) => {
      if (updated && updated.id === problem.dbId) {
        if (updated.end_time) {
          setCurrentEndTime(updated.end_time);
          setExtraTimeAlert(`Faculty updated deadline: Extra time granted until ${new Date(updated.end_time).toLocaleTimeString()}!`);
          setTimeout(() => setExtraTimeAlert(null), 8000);
        }
        if (updated.start_time) {
          setCurrentStartTime(updated.start_time);
        }
      }
    };

    socket.on('practical_updated', handlePracticalUpdated);
    return () => {
      socket.off('practical_updated', handlePracticalUpdated);
    };
  }, [socket, problem?.dbId]);

  // Live ticking countdown timer
  useEffect(() => {
    if (!currentEndTime && !currentStartTime) {
      setCountdownStr('');
      setIsExpired(false);
      setIsUpcoming(false);
      return;
    }

    const tick = () => {
      const now = Date.now();
      const startMs = currentStartTime ? new Date(currentStartTime).getTime() : 0;
      const endMs = currentEndTime ? new Date(currentEndTime).getTime() : 0;

      if (startMs && now < startMs) {
        setIsUpcoming(true);
        setIsExpired(false);
        const diffSecs = Math.floor((startMs - now) / 1000);
        const h = Math.floor(diffSecs / 3600);
        const m = Math.floor((diffSecs % 3600) / 60);
        const s = diffSecs % 60;
        setCountdownStr(`Starts in ${h}h ${m}m ${s}s`);
        return;
      }

      setIsUpcoming(false);

      if (endMs) {
        if (now > endMs) {
          setIsExpired(true);
          setCountdownStr('00:00:00');
        } else {
          setIsExpired(false);
          const diffSecs = Math.floor((endMs - now) / 1000);
          const h = Math.floor(diffSecs / 3600);
          const m = Math.floor((diffSecs % 3600) / 60);
          const s = diffSecs % 60;
          const pad = (n) => n.toString().padStart(2, '0');
          setCountdownStr(`${pad(h)}:${pad(m)}:${pad(s)}`);
        }
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [currentStartTime, currentEndTime]);

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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--student-code-bg-0d0d0d, #0d0d0d)', fontFamily: 'Inter, sans-serif', color: 'var(--student-code-text-bbbbbb, #bbbbbb)' }}>

      {/* Tab Bar */}
      <div style={{ display: 'flex', alignItems: 'flex-end', background: 'var(--student-code-bg-000000, #000000)', borderBottom: '1px solid var(--student-code-border-262626, #262626)', padding: '0 20px', flexShrink: 0, overflowX: 'auto' }}>
        {TABS.map(({ id, icon, label }) => (
          <button suppressHydrationWarning
            key={id}
            onClick={() => setActiveTab(id)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === id ? '2px solid #ffffff' : '2px solid transparent',
              color: activeTab === id ? 'var(--student-code-text-ffffff, #ffffff)' : 'var(--student-code-text-7e7e7e, #7e7e7e)',
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
            {/* Real-time extra time alert notification */}
            {extraTimeAlert && (
              <div style={{
                backgroundColor: '#064e3b', border: '1px solid #059669', color: 'var(--student-code-text-a7f3d0, #a7f3d0)',
                padding: '10px 16px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600,
                marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px'
              }}>
                🎉 {extraTimeAlert}
              </div>
            )}

            {/* Problem number + title */}
            <h1 style={{ color: 'var(--student-code-text-ffffff, #ffffff)', fontSize: '22px', fontWeight: 700, marginBottom: '16px', lineHeight: 1.2 }}>{p.title}</h1>

            {/* Difficulty + tags */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <span style={{ color: diff.color, background: diff.bg, border: `1px solid ${diff.border}`, fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', padding: '3px 10px' }}>
                {p.difficulty}
              </span>
              {p.topics && p.topics.split(",").map(topic => <button suppressHydrationWarning key={topic.trim()} style={{ background: 'var(--student-code-bg-1a1a1a, #1a1a1a)', border: '1px solid var(--student-code-border-262626, #262626)', color: 'var(--student-code-text-7e7e7e, #7e7e7e)', fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', padding: '3px 10px', cursor: 'default' }}>{topic.trim()}</button>)}
            </div>

            {/* Description */}
            <div
              style={{ fontSize: '15px', fontWeight: 300, lineHeight: 1.7, color: 'var(--student-code-text-bbbbbb, #bbbbbb)', marginBottom: '32px' }}
              dangerouslySetInnerHTML={{ __html: p.description }}
            />

            {/* Examples */}
            {/* Examples (Static Problems) */}
            {!p.isPractical && p.examples && p.examples.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
                {p.examples.map((ex, i) => (
                  <div key={i}>
                    <p style={{ color: 'var(--student-code-text-e6e6e6, #e6e6e6)', fontWeight: 700, fontSize: '13px', marginBottom: '8px', letterSpacing: '0.5px' }}>Example {i + 1}:</p>
                    <div style={{ background: 'var(--student-code-bg-1a1a1a, #1a1a1a)', borderLeft: '3px solid #0066b1', padding: '14px 16px', fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace', fontSize: '13px' }}>
                      <div style={{ marginBottom: '4px' }}><span style={{ color: 'var(--student-code-text-7e7e7e, #7e7e7e)' }}>Input: </span><span style={{ color: 'var(--student-code-text-e6e6e6, #e6e6e6)' }}>{ex.input}</span></div>
                      <div style={{ marginBottom: ex.explanation ? '4px' : 0 }}><span style={{ color: 'var(--student-code-text-7e7e7e, #7e7e7e)' }}>Output: </span><span style={{ color: 'var(--student-code-text-e6e6e6, #e6e6e6)' }}>{ex.output}</span></div>
                      {ex.explanation && <div><span style={{ color: 'var(--student-code-text-7e7e7e, #7e7e7e)' }}>Explanation: </span><span style={{ color: 'var(--student-code-text-e6e6e6, #e6e6e6)' }}>{ex.explanation}</span></div>}
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
                    <p style={{ color: 'var(--student-code-text-e6e6e6, #e6e6e6)', fontWeight: 700, fontSize: '13px', marginBottom: '8px', letterSpacing: '0.5px' }}>Input Format:</p>
                    <div style={{ background: 'var(--student-code-bg-1a1a1a, #1a1a1a)', borderLeft: '3px solid #00b8a3', padding: '14px 16px', fontSize: '13px', color: 'var(--student-code-text-bbbbbb, #bbbbbb)', whiteSpace: 'pre-wrap' }}>
                      {p.inputFormat}
                    </div>
                  </div>
                )}
                {p.outputFormat && (
                  <div>
                    <p style={{ color: 'var(--student-code-text-e6e6e6, #e6e6e6)', fontWeight: 700, fontSize: '13px', marginBottom: '8px', letterSpacing: '0.5px' }}>Output Format:</p>
                    <div style={{ background: 'var(--student-code-bg-1a1a1a, #1a1a1a)', borderLeft: '3px solid #00b8a3', padding: '14px 16px', fontSize: '13px', color: 'var(--student-code-text-bbbbbb, #bbbbbb)', whiteSpace: 'pre-wrap' }}>
                      {p.outputFormat}
                    </div>
                  </div>
                )}
                {(() => {
                  if (!p.sampleInput) return null;
                  try {
                    const parsed = JSON.parse(p.sampleInput);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                          {parsed.map((ex, i) => (
                            <div key={i}>
                              <p style={{ color: 'var(--student-code-text-e6e6e6, #e6e6e6)', fontWeight: 700, fontSize: '13px', marginBottom: '8px', letterSpacing: '0.5px' }}>Sample {i + 1}:</p>
                              <div style={{ background: 'var(--student-code-bg-1a1a1a, #1a1a1a)', borderLeft: '3px solid #00b8a3', padding: '14px 16px', fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace', fontSize: '13px' }}>
                                <div style={{ marginBottom: '4px' }}><span style={{ color: 'var(--student-code-text-7e7e7e, #7e7e7e)' }}>Input: </span><br/><span style={{ color: 'var(--student-code-text-e6e6e6, #e6e6e6)', whiteSpace: 'pre-wrap' }}>{ex.input}</span></div>
                                <div style={{ marginTop: '10px' }}><span style={{ color: 'var(--student-code-text-7e7e7e, #7e7e7e)' }}>Output: </span><br/><span style={{ color: 'var(--student-code-text-e6e6e6, #e6e6e6)', whiteSpace: 'pre-wrap' }}>{ex.expected || ex.output}</span></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    }
                  } catch (e) {
                    // fall back to old behavior
                  }
                  
                  return (
                    <>
                      <div>
                        <p style={{ color: 'var(--student-code-text-e6e6e6, #e6e6e6)', fontWeight: 700, fontSize: '13px', marginBottom: '8px', letterSpacing: '0.5px' }}>Sample Input:</p>
                        <pre style={{ background: 'var(--student-code-bg-1a1a1a, #1a1a1a)', border: '1px solid var(--student-code-border-262626, #262626)', padding: '14px 16px', fontFamily: 'monospace', fontSize: '13px', color: 'var(--student-code-text-e6e6e6, #e6e6e6)', overflowX: 'auto', margin: 0, whiteSpace: 'pre-wrap' }}>
                          {p.sampleInput}
                        </pre>
                      </div>
                      {p.sampleOutput && (
                        <div style={{ marginTop: '20px' }}>
                          <p style={{ color: 'var(--student-code-text-e6e6e6, #e6e6e6)', fontWeight: 700, fontSize: '13px', marginBottom: '8px', letterSpacing: '0.5px' }}>Sample Output:</p>
                          <pre style={{ background: 'var(--student-code-bg-1a1a1a, #1a1a1a)', border: '1px solid var(--student-code-border-262626, #262626)', padding: '14px 16px', fontFamily: 'monospace', fontSize: '13px', color: 'var(--student-code-text-e6e6e6, #e6e6e6)', overflowX: 'auto', margin: 0, whiteSpace: 'pre-wrap' }}>
                            {p.sampleOutput}
                          </pre>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {/* Constraints (Static Problems) */}
            {!p.isPractical && p.constraints && p.constraints.length > 0 && (
              <div>
                <p style={{ color: 'var(--student-code-text-e6e6e6, #e6e6e6)', fontWeight: 700, fontSize: '13px', marginBottom: '12px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Constraints</p>
                <div style={{ background: 'var(--student-code-bg-1a1a1a, #1a1a1a)', border: '1px solid var(--student-code-border-262626, #262626)', padding: '16px' }}>
                  {p.constraints.map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: i < p.constraints.length - 1 ? '8px' : 0, fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace', fontSize: '13px', color: 'var(--student-code-text-bbbbbb, #bbbbbb)' }}>
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
                <p style={{ color: 'var(--student-code-text-e6e6e6, #e6e6e6)', fontWeight: 700, fontSize: '13px', marginBottom: '12px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Constraints</p>
                <div style={{ background: 'var(--student-code-bg-1a1a1a, #1a1a1a)', border: '1px solid var(--student-code-border-262626, #262626)', padding: '16px', fontSize: '13px', color: 'var(--student-code-text-bbbbbb, #bbbbbb)', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                  {p.constraints}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'submissions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--student-code-text-ffffff, #ffffff)', marginBottom: '4px' }}>Recorded Submission & Grade</h3>
              <p style={{ fontSize: '12px', color: 'var(--student-code-text-7e7e7e, #7e7e7e)', margin: 0 }}>
                Your single highest marks achieved are permanently preserved and shown here.
              </p>
            </div>
            
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '30px', color: 'var(--student-code-text-7e7e7e, #7e7e7e)', fontSize: '13px' }}>
                Loading submission record...
              </div>
            ) : submissions.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--student-code-text-5e5e5e, #5e5e5e)', fontSize: '13px', background: 'var(--student-code-bg-111111, #111)', borderRadius: '6px' }}>
                No submissions recorded yet for this practical. Write your solution and click <strong>Submit Code</strong>!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {submissions.map((sub) => {
                  const isAccepted = sub.status === 'Accepted' || sub.status === 'Passed' || sub.status === 'success';
                  return (
                    <div key={sub.id} style={{ backgroundColor: 'var(--student-code-bg-141414, #141414)', border: '1px solid var(--student-code-border-262626, #262626)', borderRadius: '10px', padding: '18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: '12px',
                          backgroundColor: isAccepted ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                          color: isAccepted ? '#10b981' : '#ef4444',
                        }}>
                          {sub.status.toUpperCase()}
                        </span>
                      </div>

                      <div style={{
                        backgroundColor: 'var(--student-code-bg-0a0a0a, #0a0a0a)', border: '1px solid var(--student-code-border-1e1e1e, #1e1e1e)', borderRadius: '8px',
                        padding: '14px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}>
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--student-code-text-888888, #888)', textTransform: 'uppercase', fontWeight: 600 }}>Highest Stored Marks</div>
                          <div style={{ fontSize: '24px', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>
                            {sub.normalized_marks} <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--student-code-text-777777, #777)' }}>/ 10</span>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '11px', color: 'var(--student-code-text-888888, #888)' }}>Raw Points: <strong style={{ color: 'var(--student-code-text-ffffff, #fff)' }}>{sub.raw_marks}</strong></div>
                          <div style={{ fontSize: '11px', color: 'var(--student-code-text-666666, #666)', marginTop: '4px' }}>
                            {new Date(sub.submitted_at).toLocaleString()}
                          </div>
                        </div>
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
