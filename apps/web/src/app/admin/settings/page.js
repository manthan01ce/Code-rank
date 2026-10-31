'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import LoadingOverlay from '@/components/LoadingOverlay';

export default function Settings() {
  const [user, setUser] = useState(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (processing) return;
    setProcessing(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/password', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await res.json();
      if (res.ok) {
        if (data.token) {
          localStorage.setItem('token', data.token);
          // Reload reconnects any shared socket with the replacement session.
          window.location.reload();
          return;
        }
        setMessage('Password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setError(data.error || 'Failed to update password');
      }
    } catch (err) {
      setError('Internal error occurred');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      {processing && <LoadingOverlay />}
      <div className="header">
        <div><h2>Account settings</h2><p>Manage your account details and sign-in security.</p></div>
      </div>

      <div className="admin-settings-grid">

        {/* Profile Card */}
        <div className="table-container" style={{ margin: 0 }}>
          <h3 style={{ marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Admin Profile</h3>
          {user ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase' }}>Full Name</label>
                <p style={{ fontWeight: 600, fontSize: '16px' }}>{user.name}</p>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase' }}>Email Address</label>
                <p style={{ fontWeight: 600, fontSize: '16px' }}>{user.email}</p>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase' }}>Role</label>
                <p style={{ fontWeight: 600, color: 'var(--primary)', fontSize: '16px' }}>{user.role.toUpperCase()}</p>
                <Link className="admin-profile-link" href={`/profile/${encodeURIComponent(user.email.split('@')[0])}`}>View and edit profile →</Link>
              </div>
            </div>
          ) : (
            <p>Loading profile...</p>
          )}
        </div>

        {/* Password Reset Card */}
        <div className="table-container" style={{ margin: 0 }}>
          <h3 style={{ marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Security</h3>

          {message && <div role="status" style={{ padding: '10px', background: '#eff1ff', color: '#4338ca', borderRadius: '4px', marginBottom: '15px' }}>{message}</div>}
          {error && <div role="alert" style={{ padding: '10px', background: '#fee2e2', color: '#b91c1c', borderRadius: '4px', marginBottom: '15px' }}>{error}</div>}

          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <label htmlFor="settings-current-password" style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>Current Password</label>
              <input
                type="password"
                className="input-field"
                style={{ width: '100%' }}
                id="settings-current-password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="settings-new-password" style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>New Password</label>
              <input
                type="password"
                className="input-field"
                style={{ width: '100%' }}
                id="settings-new-password"
                autoComplete="new-password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div>
              <label htmlFor="settings-confirm-password" style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>Confirm New Password</label>
              <input
                type="password"
                className="input-field"
                style={{ width: '100%' }}
                id="settings-confirm-password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" disabled={processing} className="btn-primary" style={{ marginTop: '10px' }}>
              Update Password
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
