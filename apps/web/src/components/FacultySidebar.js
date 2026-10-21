'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import ChangePasswordModal from './ChangePasswordModal';
import LogoutConfirmModal from './LogoutConfirmModal';

export default function FacultySidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
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

  const [isHydrated, setIsHydrated] = useState(false);

  // Wait for client-side hydration before reading localStorage
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const parsed = JSON.parse(userData);
        if (parsed.role !== 'faculty' && parsed.role !== 'admin') {
          router.replace('/login');
          return;
        }
        setUser(parsed);
      } catch {
        router.replace('/login');
      }
    }
  }, [isHydrated, router]);

  const [activeMenu, setActiveMenu] = useState('dashboard');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search;
      if (search.includes('tab=submissions')) {
        setActiveMenu('submissions');
      } else if (search.includes('tab=marks')) {
        setActiveMenu('marks');
      } else {
        setActiveMenu('dashboard');
      }
    }
  }, [pathname]);

  const handleLogout = () => setShowLogoutModal(true);

  const confirmLogout = () => {
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
                    const handle = user?.email ? user.email.split('@')[0] : 'faculty';
                    router.push(`/profile/${handle}`);
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
      <div className="sidebar" style={{ paddingTop: '20px', position: 'fixed', left: 0, top: 0, bottom: 0, width: '280px', zIndex: 99 }}>
        <div className="logo-container" style={{ padding: '0 20px', textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ width: '60px', height: '60px', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', overflow: 'hidden', background: '#ffffff', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.15)' }}>
            <img 
              src="/coderank-logo.jpg" 
              alt="CodeRank Logo" 
              onError={(e) => { e.target.style.display = 'none'; if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'; }}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div style={{ display: 'none', width: '100%', height: '100%', background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', borderRadius: '50%', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: 'white', fontWeight: 800 }}>
              CR
            </div>
          </div>
          <h2 className="brand-text" style={{ fontSize: '22px', marginBottom: '5px' }}>CodeRank</h2>
          <p style={{ fontSize: '12px', color: '#888' }}>Faculty Dashboard</p>
        </div>
 
        <ul className="sidebar-nav">
          <li className={activeMenu === 'dashboard' ? 'active' : ''} onClick={() => router.push('/faculty')}>
             Dashboard
          </li>
          <li className={activeMenu === 'submissions' ? 'active' : ''} onClick={() => router.push('/faculty?tab=submissions')}>
            📥 Student submissions
          </li>
          <li className={activeMenu === 'marks' ? 'active' : ''} onClick={() => router.push('/faculty?tab=marks')}>
             Marks overview
          </li>
          <li style={{ marginTop: 'auto', color: '#ef4444', cursor: 'pointer', fontWeight: '600' }} onClick={handleLogout}>
             Logout
          </li>
        </ul>
      </div>
      <ChangePasswordModal isOpen={isChangePasswordOpen} onClose={() => setIsChangePasswordOpen(false)} />
      <LogoutConfirmModal
        isOpen={showLogoutModal}
        onConfirm={confirmLogout}
        onCancel={() => setShowLogoutModal(false)}
      />
    </>
  );
}
