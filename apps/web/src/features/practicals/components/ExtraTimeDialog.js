'use client';

import { useState } from 'react';
import { TimelineBadge } from './TimelineBadge';

/**
 * Modal dialog for extending practical deadlines.
 * @param {Object} props
 * @param {Object} props.practical
 * @param {number} props.currentTime
 * @param {boolean} props.processing
 * @param {Function} props.onApply (minutes, customDate) => Promise<void>
 * @param {Function} props.onClose () => void
 */
export function ExtraTimeDialog({ practical, currentTime, processing, onApply, onClose }) {
  const [extraMinutesInput, setExtraMinutesInput] = useState(15);
  const [customEndTimeInput, setCustomEndTimeInput] = useState('');

  if (!practical) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px'
    }}>
      <div style={{
        background: 'white', borderRadius: '16px', padding: '28px',
        width: '100%', maxWidth: '520px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Extend Timeline
            </span>
            <h3 style={{ fontSize: '19px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
              Grant Extra Time
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}
          >
            ×
          </button>
        </div>

        <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Practical: <strong style={{ color: 'var(--text-main)' }}>{practical.title}</strong>
        </p>

        <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', marginBottom: '20px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Current Status:</div>
          <div style={{ marginTop: '4px' }}>
            <TimelineBadge startTime={practical.start_time} endTime={practical.end_time} currentTime={currentTime} />
          </div>
          {practical.end_time && (
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
              Deadline: <strong>{new Date(practical.end_time).toLocaleString()}</strong>
            </div>
          )}
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>
            ⚡ Quick Add Presets:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            {[10, 15, 30, 60].map(mins => (
              <button
                key={mins}
                type="button"
                onClick={() => onApply(mins)}
                disabled={processing}
                style={{
                  padding: '10px 8px', borderRadius: '8px', border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff', color: '#1e293b', fontWeight: 600, fontSize: '13px',
                  cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center'
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#1e293b'; }}
              >
                +{mins >= 60 ? `${mins / 60}h` : `${mins}m`}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>
            Or Add Custom Minutes:
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="number"
              min="1"
              max="1440"
              className="input-field"
              placeholder="e.g. 45"
              value={extraMinutesInput}
              onChange={e => setExtraMinutesInput(e.target.value)}
              style={{ flex: 1, padding: '8px 12px' }}
            />
            <button
              type="button"
              onClick={() => onApply(parseInt(extraMinutesInput))}
              disabled={processing || !extraMinutesInput}
              className="btn-primary"
              style={{ width: 'auto', padding: '8px 18px', margin: 0, fontSize: '13px' }}
            >
              Apply
            </button>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>
            Or Pick Exact New End Time:
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="datetime-local"
              className="input-field"
              value={customEndTimeInput}
              onChange={e => setCustomEndTimeInput(e.target.value)}
              style={{ flex: 1, padding: '8px 12px' }}
            />
            <button
              type="button"
              onClick={() => onApply(null, customEndTimeInput)}
              disabled={processing || !customEndTimeInput}
              style={{
                padding: '8px 18px', borderRadius: '6px', border: '1px solid var(--primary)',
                backgroundColor: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Set
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 20px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'transparent', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
