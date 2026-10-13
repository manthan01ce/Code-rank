'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import HeaderProfileDropdown from './HeaderProfileDropdown';

export default function AdminSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);

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
      <div className="sidebar" style={{ paddingTop: '20px' }}>
        <div className="logo-container" style={{ padding: '0 20px', textAlign: 'center', marginBottom: '30px' }}>
          <img 
            src="/coderank-logo.jpg" 
            alt="CodeRank Logo" 
            onError={(e) => { e.target.src = '/coderank-logo.jpg'; }}
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
    </>
  );
}
