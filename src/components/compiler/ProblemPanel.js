'use client';

import { useState } from 'react';
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
  { id: 'editorial',   icon: <Lightbulb size={13} />,     label: 'EDITORIAL'   },
  { id: 'solutions',   icon: <MessageSquare size={13} />, label: 'SOLUTIONS'   },
  { id: 'submissions', icon: <Clock size={13} />,         label: 'SUBMISSIONS' },
];

export default function ProblemPanel({ problem }) {
  const [activeTab, setActiveTab] = useState('description');
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
            {p.examples && p.examples.length > 0 && (
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

            {/* Constraints */}
            {p.constraints && p.constraints.length > 0 && (
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
          </div>
        )}

        {activeTab !== 'description' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#3c3c3c', fontSize: '13px', fontWeight: 300, letterSpacing: '0.5px' }}>
            Content coming soon.
          </div>
        )}
      </div>
    </div>
  );
}
