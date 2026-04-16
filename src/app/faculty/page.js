'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function FacultyDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    } else {
      router.push('/');
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  if (!user) return null;

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      padding: '20px',
      textAlign: 'center'
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
          backgroundColor: '#eff6ff', 
          borderRadius: '50%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          margin: '0 auto 20px',
          color: '#3b82f6',
          fontSize: '40px'
        }}>
          🎓
        </div>
        <h1 style={{ color: '#1e293b', marginBottom: '10px', fontSize: '24px' }}>Registered Successfully</h1>
        <p style={{ color: '#64748b', marginBottom: '30px', lineHeight: '1.6' }}>
          Greetings, <strong>{user.name}</strong>! Your account has been successfully registered as a <strong>Faculty Member</strong>. 
          The administration team is currently setting up your portal.
        </p>
        
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
          <button 
            className="btn-primary" 
            style={{ width: 'auto', padding: '12px 30px', margin: 0, backgroundColor: '#3b82f6' }}
            onClick={handleLogout}
          >
            ← Back to Login
          </button>
        </div>
      </div>
      
      <p style={{ marginTop: '20px', color: '#94a3b8', fontSize: '14px' }}>
        © 2026 CodeRank. All rights reserved.
      </p>
    </div>
  );
}
