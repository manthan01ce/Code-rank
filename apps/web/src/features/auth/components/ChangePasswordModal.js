'use client';

import { useState, useMemo } from 'react';

// Password strength rule definitions
const PASSWORD_RULES = [
  { id: 'length',    label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'uppercase', label: 'One uppercase letter',   test: (p) => /[A-Z]/.test(p) },
  { id: 'number',    label: 'One number',             test: (p) => /[0-9]/.test(p) },
];

function RuleHint({ passed, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: passed ? '#16a34a' : '#94a3b8' }}>
      <span style={{
        width: '14px', height: '14px', borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: passed ? '#dcfce7' : '#f1f5f9',
        border: `1px solid ${passed ? '#86efac' : '#e2e8f0'}`,
        fontSize: '9px', fontWeight: 700,
      }}>
        {passed ? '✓' : '·'}
      </span>
      {label}
    </div>
  );
}

export default function ChangePasswordModal({ isOpen, onClose }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPasswordTouched, setNewPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  if (!isOpen) return null;

  const ruleResults = PASSWORD_RULES.map(r => ({ ...r, passed: r.test(newPassword) }));
  const allRulesPassed = ruleResults.every(r => r.passed);
  const passwordsMatch = newPassword === confirmPassword;
  const isValid = allRulesPassed && passwordsMatch && currentPassword.length > 0 && confirmPassword.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    if (!isValid) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      let data = {};
      try { data = await res.json(); } catch {}

      if (res.ok) {
        if (data.token) {
          localStorage.setItem('token', data.token);
          window.location.reload();
          return;
        }
        setMessage({ type: 'success', text: 'Password updated successfully!' });
        setTimeout(() => {
          onClose();
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
          setNewPasswordTouched(false);
          setConfirmTouched(false);
          setMessage(null);
        }, 1500);
      } else {
        const errorText = data.error || 'Incorrect current password or server error.';
        setMessage({ type: 'error', text: errorText });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Unable to reach the server. Please check your connection.' });
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (hasError) => ({
    width: '100%',
    padding: '10px 12px',
    borderRadius: '6px',
    border: `1px solid ${hasError ? '#fca5a5' : '#cbd5e1'}`,
    fontSize: '14px',
    color: '#1e293b',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
      backdropFilter: 'blur(2px)',
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '12px', padding: '30px',
        width: '440px', boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column', gap: '16px',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#1e293b', margin: 0 }}>Change Password</h3>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '3px 0 0 0' }}>Update your account password below.</p>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: '#f1f5f9', width: '28px', height: '28px', borderRadius: '6px', fontSize: '16px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {/* Status Banner */}
        {message && (
          <div style={{
            padding: '10px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
            backgroundColor: message.type === 'success' ? '#ecfdf5' : '#fef2f2',
            color: message.type === 'success' ? '#065f46' : '#991b1b',
            border: `1px solid ${message.type === 'success' ? '#a7f3d0' : '#fca5a5'}`,
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span>{message.type === 'success' ? '✓' : '⚠'}</span>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Current Password */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Current Password
            </label>
            <input
              id="current-password"
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              style={inputStyle(false)}
              placeholder="Enter your current password"
            />
          </div>

          {/* New Password */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              required
              autoComplete="new-password"
              value={newPassword}
              onChange={e => { setNewPassword(e.target.value); setNewPasswordTouched(true); }}
              style={inputStyle(newPasswordTouched && !allRulesPassed)}
              placeholder="Create a strong password"
            />
            {/* Inline password rules — shown once user starts typing */}
            {newPasswordTouched && (
              <div style={{ marginTop: '8px', padding: '10px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {ruleResults.map(r => <RuleHint key={r.id} passed={r.passed} label={r.label} />)}
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); setConfirmTouched(true); }}
              style={inputStyle(confirmTouched && confirmPassword.length > 0 && !passwordsMatch)}
              placeholder="Re-enter your new password"
            />
            {confirmTouched && confirmPassword.length > 0 && (
              <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: passwordsMatch ? '#16a34a' : '#dc2626', display: 'flex', alignItems: 'center', gap: '5px' }}>
                {passwordsMatch ? '✓ Passwords match' : '✕ Passwords do not match'}
              </p>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '6px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '9px 18px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#475569', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !isValid}
              title={!isValid ? 'Fill in all fields and meet password requirements' : undefined}
              style={{
                padding: '9px 22px', borderRadius: '6px', border: 'none',
                backgroundColor: isValid ? '#4f46e5' : '#c7d2fe',
                color: 'white', cursor: isValid ? 'pointer' : 'not-allowed',
                fontSize: '13px', fontWeight: 700,
                transition: 'background-color 0.2s',
              }}
            >
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
