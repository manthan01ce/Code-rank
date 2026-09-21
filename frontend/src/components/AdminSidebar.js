'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import ChangePasswordModal from './ChangePasswordModal';

export default function AdminSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsed = JSON.parse(userData);
      if (parsed.role !== 'admin') {
        router.push('/');
      }
      setUser(parsed);
    } else {
      router.push('/');
    }
  }, []);

  const handleLogout = () => {
    if (!window.confirm("Are you sure you want to log out?")) return;

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
        <div ref={profileRef} style={{ position: 'relative' }}>
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
            onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
            onMouseLeave={(e) => e.target.style.backgroundColor = showProfileMenu ? '#f0f0f0' : 'transparent'}
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
              {user?.name?.charAt(0).toUpperCase() || 'A'}
            </div>
            
            {/* User Info */}
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>
                {user?.name || 'Admin'}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                {user?.role?.toUpperCase() || 'ADMIN'}
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
                  {user?.name || 'Admin'}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  {user?.email || 'admin@example.com'}
                </div>
              </div>

              {/* Menu Items */}
              <div style={{ padding: '8px 0' }}>
                <button
                  onClick={() => {
                    router.push('/admin/settings');
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
                   Settings
                </button>

                <button
                  onClick={() => {
                    // Show profile info
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

                <button
                  onClick={() => {
                    setIsChangePasswordOpen(true);
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
                  🔑 Change Password
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
                   Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div className="sidebar" style={{ paddingTop: '20px' }}>
        <div className="logo-container" style={{ padding: '0 20px', textAlign: 'center', marginBottom: '30px' }}>
          <img 
            src="/coderank-logo.svg" 
            alt="CodeRank Logo" 
            onError={(e) => { e.target.src = '/coderank-logo.svg'; }}
            style={{ width: '60px', height: '60px', objectFit: 'contain', marginBottom: '10px' }}
          />
          <h2 className="brand-text" style={{ fontSize: '22px', marginBottom: '5px' }}>CodeRank</h2>
          <p style={{ fontSize: '12px', color: '#888' }}>Admin Panel</p>
        </div>

        <ul className="sidebar-nav">
          <li className={pathname === '/admin' ? 'active' : ''} onClick={() => router.push('/admin')}>
            Dashboard
          </li>
          <li className={pathname === '/admin/departments' ? 'active' : ''} onClick={() => router.push('/admin/departments')}>
            Department Master
          </li>
          <li className={pathname === '/admin/faculty' ? 'active' : ''} onClick={() => router.push('/admin/faculty')}>
            Faculty Master
          </li>
          <li className={pathname === '/admin/students' ? 'active' : ''} onClick={() => router.push('/admin/students')}>
            Student Master
          </li>
          <li className={pathname === '/admin/courses' ? 'active' : ''} onClick={() => router.push('/admin/courses')}>
            Courses
          </li>
          <li className={pathname === '/admin/mapping' ? 'active' : ''} onClick={() => router.push('/admin/mapping')}>
            Course Mapping
          </li>
          <li className={pathname === '/admin/logs' ? 'active' : ''} onClick={() => router.push('/admin/logs')}>
            Activity Logs
          </li>
          <li className={pathname === '/admin/settings' ? 'active' : ''} onClick={() => router.push('/admin/settings')}>
            Settings
          </li>
          <li style={{ marginTop: 'auto', color: '#ef4444', cursor: 'pointer', fontWeight: '600' }} onClick={handleLogout}>
             Logout
          </li>
        </ul>
      </div>
      <ChangePasswordModal isOpen={isChangePasswordOpen} onClose={() => setIsChangePasswordOpen(false)} />
    </>
  );
}
