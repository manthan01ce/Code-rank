'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './RefreshButton.module.css';

export default function RefreshButton({ onRefresh, children = 'Refresh', disabled = false, className = '', ...props }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const running = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function refresh() {
    if (running.current || disabled) return;
    running.current = true;
    setBusy(true);
    setFailed(false);
    const started = Date.now();
    try { await onRefresh(); }
    catch { if (mounted.current) setFailed(true); }
    finally {
      // Keep instant responses perceptible without delaying the data update.
      await new Promise(resolve => setTimeout(resolve, Math.max(0, 450 - (Date.now() - started))));
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return <button {...props} type="button" onClick={refresh} disabled={disabled || busy} aria-busy={busy} className={`${className} ${styles.button}`}>
    <span className={busy ? styles.spinner : styles.icon} aria-hidden="true">{busy ? '' : '↻'}</span>
    <span role="status" aria-live="polite">{busy ? 'Refreshing…' : failed ? 'Retry refresh' : children}</span>
  </button>;
}
