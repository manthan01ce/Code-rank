'use client';

import { useState } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * RefreshButton
 * -------------
 * Standardized, accessible refresh button for Admin, Faculty, and Student dashboards.
 *
 * Requirements satisfied:
 *  - Real backend fetch invocation via async `onRefresh`.
 *  - Inline spinning loader indicator during progress.
 *  - Disables itself to prevent overlapping/duplicate clicks.
 *  - Shows feedback notification badge on success or error.
 *  - Displays and updates last-refreshed timestamp.
 *  - Preserves surrounding page/form state (filters, search, pagination).
 */
export default function RefreshButton({
  onRefresh,
  lastUpdated,
  label = 'Refresh',
  variant = 'default',
  showTimestamp = true,
  style = {}
}) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', text: string }

  const handleClick = async () => {
    if (loading || typeof onRefresh !== 'function') return;

    setLoading(true);
    setFeedback(null);

    try {
      await onRefresh();
      setFeedback({ type: 'success', text: 'Refreshed' });
      setTimeout(() => setFeedback(null), 2500);
    } catch (err) {
      console.error('[RefreshButton] Error executing refresh:', err);
      setFeedback({ type: 'error', text: 'Failed' });
      setTimeout(() => setFeedback(null), 3500);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (date) => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const isPrimary = variant === 'primary';
  const isCompact = variant === 'compact';

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', ...style }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        aria-label="Refresh data"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          padding: isCompact ? '6px 12px' : '8px 16px',
          fontSize: isCompact ? '12px' : '13px',
          fontWeight: 600,
          borderRadius: '8px',
          border: isPrimary ? 'none' : '1px solid #cbd5e1',
          backgroundColor: isPrimary ? '#4f46e5' : '#ffffff',
          color: isPrimary ? '#ffffff' : '#334155',
          cursor: loading ? 'not-allowed' : 'pointer',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
          transition: 'all 0.15s ease',
          opacity: loading ? 0.75 : 1,
          outline: 'none',
        }}
      >
        <RefreshCw
          size={isCompact ? 13 : 15}
          style={{
            animation: loading ? 'codeRankSpin 0.9s linear infinite' : 'none',
            transformOrigin: 'center center',
          }}
        />
        <span>{loading ? 'Refreshing...' : label}</span>
      </button>

      {/* Success / Error inline status toast */}
      {feedback && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            fontWeight: 600,
            padding: '3px 8px',
            borderRadius: '6px',
            backgroundColor: feedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
            color: feedback.type === 'success' ? '#059669' : '#dc2626',
            border: `1px solid ${feedback.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
          {feedback.text}
        </span>
      )}

      {/* Timestamp */}
      {showTimestamp && lastUpdated && !feedback && (
        <span style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
          Updated {formatTimestamp(lastUpdated)}
        </span>
      )}

      <style jsx global>{`
        @keyframes codeRankSpin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
