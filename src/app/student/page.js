'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function StudentDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (!userData || !token) {
      router.push('/');
      return;
    }

    setUser(JSON.parse(userData));

    // Fetch full profile from backend to inspect semester
    fetch('/api/auth/profile', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load profile');
        return res.json();
      })
      .then((data) => {
        setProfile(data.user);
      })
      .catch((err) => {
        console.error('Failed to fetch profile:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  if (!user) return null;

  const semester = profile?.extra_info?.semester || '';
  const is4thSemester = String(semester).trim() === '4';

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      padding: '20px',
      textAlign: 'center',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '16px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
        maxWidth: '500px',
        width: '100%'
      }}>
        <div style={{ 
          width: '80px', 
          height: '80px', 
          backgroundColor: '#ecfdf5', 
          borderRadius: '50%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          margin: '0 auto 20px',
          color: '#10b981',
          fontSize: '40px'
        }}>
          ✓
        </div>
        <h1 style={{ color: '#1e293b', marginBottom: '10px', fontSize: '28px', fontWeight: '700' }}>
          Student Dashboard
        </h1>
        <p style={{ color: '#64748b', marginBottom: '30px', lineHeight: '1.6', fontSize: '15px' }}>
          Welcome, <strong>{user.name}</strong>!<br/>
          Your student account is active.
        </p>
        
        <div style={{
          backgroundColor: '#f8fafc',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '30px',
          textAlign: 'left'
        }}>
          <p style={{ color: '#475569', marginBottom: '8px', fontSize: '14px' }}>
            <strong>Email:</strong> {user.email}
          </p>
          <p style={{ color: '#475569', marginBottom: '8px', fontSize: '14px' }}>
            <strong>Registered Semester:</strong> {loading ? 'Loading…' : semester || 'Not Specified'}
          </p>
          <p style={{ color: '#475569', fontSize: '14px' }}>
            <strong>Role:</strong> Student
          </p>
        </div>

        {/* ── Dynamic Coding Workspace Access Card ── */}
        {!loading && (
          <div style={{
            background: is4thSemester ? 'rgba(0,102,177,0.05)' : '#fdf2f2',
            border: `1px solid ${is4thSemester ? 'rgba(0,102,177,0.15)' : '#fde2e2'}`,
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '30px',
            textAlign: 'left'
          }}>
            <h4 style={{ color: is4thSemester ? '#0066b1' : '#ef4444', margin: '0 0 6px 0', fontSize: '15px', fontWeight: 700 }}>
              {is4thSemester ? '🎓 Coding Workspace Enabled' : '🔒 Workspace Access Restricted'}
            </h4>
            <p style={{ color: '#64748b', fontSize: '12.5px', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              {is4thSemester 
                ? 'Your 4th-semester profile authorizes you to enter the CodeRank Interactive Coding Workspace playground.'
                : 'The CodeRank Interactive Coding Workspace playground is restricted strictly to students in the 4th semester.'}
            </p>
            {is4thSemester ? (
              <button
                onClick={() => router.push('/student/code/1')}
                style={{
                  background: '#0066b1',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '10px 20px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  width: '100%',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#1c69d4'}
                onMouseLeave={e => e.currentTarget.style.background = '#0066b1'}
              >
                Enter Coding Workspace →
              </button>
            ) : (
              <div style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 600 }}>
                Access Restricted (Current Semester: {semester || 'unspecified'})
              </div>
            )}
          </div>
        )}
        
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
          <button 
            className="btn-primary" 
            style={{ width: 'auto', padding: '12px 30px', margin: 0, background: '#475569' }}
            onClick={handleLogout}
          >
            ← Logout
          </button>
        </div>
      </div>
      
      <p style={{ marginTop: '20px', color: '#94a3b8', fontSize: '14px' }}>
        © 2026 CodeRank. All rights reserved.
      </p>
    </div>
  );
}
