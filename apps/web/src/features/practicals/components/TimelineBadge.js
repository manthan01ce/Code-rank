'use client';

/**
 * Renders an active, countdown, or expired timeline badge for a practical.
 * @param {Object} props
 * @param {string|null} props.startTime
 * @param {string|null} props.endTime
 * @param {number} [props.currentTime]
 */
export function TimelineBadge({ startTime, endTime, currentTime = Date.now() }) {
  if (!startTime && !endTime) {
    return <span style={{ color: '#94a3b8', fontSize: '11px', fontStyle: 'italic' }}>No time limit</span>;
  }

  const start = startTime ? new Date(startTime).getTime() : null;
  const end = endTime ? new Date(endTime).getTime() : null;

  if (start && currentTime < start) {
    const diffSecs = Math.max(0, Math.floor((start - currentTime) / 1000));
    const hours = Math.floor(diffSecs / 3600);
    const mins = Math.floor((diffSecs % 3600) / 60);
    const secs = diffSecs % 60;
    const startsInStr = hours > 0
      ? `${hours}h ${mins}m ${secs}s`
      : mins > 0
        ? `${mins}m ${secs}s`
        : `${secs}s`;

    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
        backgroundColor: '#eff1ff', color: '#4338ca', border: '1px solid #bfdbfe'
      }}>
        Starts in {startsInStr} ({new Date(start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
      </span>
    );
  }

  if (end) {
    if (currentTime > end) {
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
          backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca'
        }}>
          ⛔ Expired ({new Date(end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
        </span>
      );
    } else {
      const diffSecs = Math.max(0, Math.floor((end - currentTime) / 1000));
      const hours = Math.floor(diffSecs / 3600);
      const mins = Math.floor((diffSecs % 3600) / 60);
      const secs = diffSecs % 60;
      const remainingStr = hours > 0
        ? `${hours}h ${mins}m ${secs}s left`
        : mins > 0
          ? `${mins}m ${secs}s left`
          : `${secs}s left`;

      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
          backgroundColor: '#eff1ff', color: '#059669', border: '1px solid #a7f3d0'
        }}>
          Active ({remainingStr})
        </span>
      );
    }
  }

  return <span style={{ color: '#94a3b8', fontSize: '11px' }}>Active</span>;
}

export default TimelineBadge;
