'use client';

import { useState, useEffect } from 'react';
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
        <h2>Account Settings</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 400px) 1fr', gap: '20px', alignItems: 'start', marginTop: '20px' }}>
        
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
              </div>
            </div>
          ) : (
            <p>Loading profile...</p>
          )}
        </div>

        {/* Password Reset Card */}
        <div className="table-container" style={{ margin: 0 }}>
          <h3 style={{ marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Security</h3>
          
          {message && <div style={{ padding: '10px', background: '#e6f4ea', color: '#1e8e3e', borderRadius: '4px', marginBottom: '15px' }}>{message}</div>}
          {error && <div style={{ padding: '10px', background: '#fee2e2', color: '#ef4444', borderRadius: '4px', marginBottom: '15px' }}>{error}</div>}

          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>Current Password</label>
              <input 
                type="password" 
                className="input-field" 
                style={{ width: '100%' }}
                value={currentPassword} 
                onChange={e => setCurrentPassword(e.target.value)} 
                required 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>New Password</label>
              <input 
                type="password" 
                className="input-field" 
                style={{ width: '100%' }}
                value={newPassword} 
                onChange={e => setNewPassword(e.target.value)} 
                required 
                minLength={6}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>Confirm New Password</label>
              <input 
                type="password" 
                className="input-field" 
                style={{ width: '100%' }}
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                required 
              />
            </div>

            <button type="submit" className="btn-primary" style={{ marginTop: '10px' }}>
              Update Password
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
