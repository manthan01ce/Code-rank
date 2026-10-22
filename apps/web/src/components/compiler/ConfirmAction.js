'use client';
import { useEffect, useRef } from 'react';
export default function ConfirmAction({ action, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current.showModal();
    return () => { previous?.focus(); };
  }, []);
  return <dialog ref={ref} aria-labelledby="action-title" onCancel={onClose}
    style={{ width: 'min(420px, calc(100vw - 24px))', background: '#161616', color: '#fff', padding: 24, border: '1px solid #555', borderRadius: 12 }}>
    <h2 id="action-title">{action.title}</h2>
    <p>{action.message}</p>
    <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end' }}>
      <button autoFocus onClick={onClose}>Cancel</button>
      <button onClick={() => { action.confirm(); onClose(); }}>Continue</button>
    </div>
  </dialog>;
}
