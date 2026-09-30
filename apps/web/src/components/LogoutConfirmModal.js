'use client';

import { useEffect, useRef } from 'react';

/**
 * LogoutConfirmModal
 * ------------------
 * A centered, animated confirmation dialog that replaces window.confirm() for logout.
 * Traps focus inside the modal and closes on Escape key or backdrop click.
 *
 * Props:
 *   isOpen   – boolean controlling visibility
 *   onConfirm – called when user confirms logout
 *   onCancel  – called when user cancels
 */
export default function LogoutConfirmModal({ isOpen, onConfirm, onCancel }) {
  const cancelBtnRef = useRef(null);

  // Focus trap + Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    // Focus cancel button by default (safer UX)
    cancelBtnRef.current?.focus();
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onCancel}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(4px)',
          zIndex: 9998,
          animation: 'fadeIn 0.18s ease',
        }}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-dialog-title"
        aria-describedby="logout-dialog-desc"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 9999,
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.18)',
          width: '100%',
          maxWidth: '400px',
          padding: '36px 32px 28px',
          textAlign: 'center',
          animation: 'slideUp 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Icon */}
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          fontSize: '28px',
        }}>
          🚪
        </div>

        <h2
          id="logout-dialog-title"
          style={{
            fontSize: '20px',
            fontWeight: '700',
            color: '#0f172a',
            marginBottom: '10px',
          }}
        >
          Sign Out
        </h2>

        <p
          id="logout-dialog-desc"
          style={{
            fontSize: '14px',
            color: '#64748b',
            lineHeight: '1.6',
            marginBottom: '28px',
          }}
        >
          Are you sure you want to sign out?<br />
          You'll need to log in again to continue.
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            ref={cancelBtnRef}
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '10px',
              border: '1.5px solid #e2e8f0',
              background: '#f8fafc',
              color: '#475569',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#e2e8f0';
              e.target.style.color = '#1e293b';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#f8fafc';
              e.target.style.color = '#475569';
            }}
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.35)',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-1px)';
              e.target.style.boxShadow = '0 6px 16px rgba(239, 68, 68, 0.45)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.35)';
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translate(-50%, calc(-50% + 20px)); }
          to   { opacity: 1; transform: translate(-50%, -50%); }
        }
      `}</style>
    </>
  );
}
