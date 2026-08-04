'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function FacultySidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsed = JSON.parse(userData);
      if (parsed.role !== 'faculty') {
        router.push('/');
      }
      setUser(parsed);
    } else {
      router.push('/');
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  return (
    <>
      {/* Top Navigation Bar */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        left: 280,
        height: '70px',
        backgroundColor: 'white',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingRight: '30px',
        zIndex: 100
      }}>
        {/* Profile Section */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px 12px',
              borderRadius: '8px',
              transition: 'background-color 0.2s',
              backgroundColor: showProfileMenu ? '#f0f0f0' : 'transparent'
            }}
          >
            {/* Profile Avatar */}
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#4F46E5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '16px'
            }}>
              {user?.name?.charAt(0).toUpperCase() || 'F'}
            </div>
            
            {/* User Info */}
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>
                {user?.name || 'Faculty'}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                {user?.role?.toUpperCase() || 'FACULTY'}
              </div>
            </div>

            {/* Dropdown Arrow */}
            <div style={{ fontSize: '12px', color: '#64748b', marginLeft: '8px' }}>
              ▼
            </div>
          </button>

          {/* Profile Dropdown Menu */}
          {showProfileMenu && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '8px',
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              minWidth: '200px',
              zIndex: 1000,
              overflow: 'hidden'
            }}>
              {/* Profile Info */}
              <div style={{
                padding: '16px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: '#f8fafc'
              }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>
                  {user?.name || 'Faculty'}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  {user?.email || 'faculty@charusat.edu.in'}
                </div>
              </div>

              {/* Menu Items */}
              <div style={{ padding: '8px 0' }}>
                <button
                  onClick={() => {
                    alert(`Profile Information\n\nName: ${user?.name}\nEmail: ${user?.email}\nRole: ${user?.role}`);
                    setShowProfileMenu(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: 'none',
                    background: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#1e293b',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                >
                  👤 Profile
                </button>

                <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '8px 0' }} />

                <button
                  onClick={handleLogout}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: 'none',
                    background: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#ef4444',
                    fontWeight: '600',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#fef2f2'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                >
                  🚪 Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div className="sidebar" style={{ paddingTop: '20px', position: 'fixed', left: 0, top: 0, bottom: 0, width: '280px', zIndex: 99 }}>
        <div className="logo-container" style={{ padding: '0 20px', textAlign: 'center', marginBottom: '30px' }}>
          <img 
            src="/coderank-logo.png" 
            alt="CodeRank Logo" 
            onError={(e) => { e.target.src = '/coderank-logo.svg'; }}
            style={{ width: '60px', height: '60px', objectFit: 'contain', marginBottom: '10px' }}
          />
          <h2 className="brand-text" style={{ fontSize: '22px', marginBottom: '5px' }}>CodeRank</h2>
          <p style={{ fontSize: '12px', color: '#888' }}>Faculty Dashboard</p>
        </div>

        <ul className="sidebar-nav">
          <li className={pathname === '/faculty' ? 'active' : ''} onClick={() => router.push('/faculty')}>
            📊 Dashboard
          </li>
          <li style={{ marginTop: 'auto', color: '#ef4444', cursor: 'pointer', fontWeight: '600' }} onClick={handleLogout}>
            🚪 Logout
          </li>
        </ul>
      </div>
    </>
  );
}
