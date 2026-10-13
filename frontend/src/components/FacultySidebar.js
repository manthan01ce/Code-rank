'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import HeaderProfileDropdown from './HeaderProfileDropdown';

export default function FacultySidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);

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

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      router.push('/');
    }
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
        <HeaderProfileDropdown user={user} />
      </div>
 
      {/* Sidebar */}
      <div className="sidebar" style={{ paddingTop: '20px', position: 'fixed', left: 0, top: 0, bottom: 0, width: '280px', zIndex: 99 }}>
        <div className="logo-container" style={{ padding: '0 20px', textAlign: 'center', marginBottom: '30px' }}>
          <img 
            src="/coderank-logo.jpg" 
            alt="CodeRank Logo" 
            onError={(e) => { e.target.src = '/coderank-logo.jpg'; }}
            style={{ width: '60px', height: '60px', objectFit: 'contain', marginBottom: '10px' }}
          />
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
    </>
  );
}
