'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LayoutDashboard, Inbox, Award, LogOut } from 'lucide-react';
import HeaderProfileDropdown from './HeaderProfileDropdown';
import NotificationDropdown from './NotificationDropdown';

export default function FacultySidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [activeMenu, setActiveMenu] = useState('dashboard');

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const parsed = JSON.parse(userData);
        if (parsed.role !== 'faculty') {
          router.push('/');
        }
        setUser(parsed);
      } catch {
        router.push('/');
      }
    } else {
      router.push('/');
    }
  }, [router]);

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

  const navItems = [
    { id: 'dashboard', label: 'Practicals Dashboard', path: '/faculty', icon: <LayoutDashboard size={18} /> },
    { id: 'submissions', label: 'Student Submissions', path: '/faculty?tab=submissions', icon: <Inbox size={18} /> },
    { id: 'marks', label: 'Marks Overview', path: '/faculty?tab=marks', icon: <Award size={18} /> },
  ];

  return (
    <>
      {/* Top Navigation Bar */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        left: 280,
        height: '70px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingRight: '30px',
        gap: '16px',
        zIndex: 100
      }}>
        <NotificationDropdown user={user} />
        <HeaderProfileDropdown user={user} />
      </div>

      {/* Sidebar */}
      <div className="sidebar" style={{ paddingTop: '20px', position: 'fixed', left: 0, top: 0, bottom: 0, width: '280px', zIndex: 99 }}>
        <div className="logo-container" style={{ padding: '0 20px', textAlign: 'center', marginBottom: '24px' }}>
          <img 
            src="/coderank-logo.jpg" 
            alt="CodeRank Logo" 
            onError={(e) => { e.target.src = '/coderank-logo.jpg'; }}
            style={{ width: '56px', height: '56px', objectFit: 'contain', marginBottom: '8px', borderRadius: '10px' }}
          />
          <h2 className="brand-text" style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 2px 0', color: '#1e293b' }}>
            CodeRank
          </h2>
          <p style={{ fontSize: '11px', fontWeight: 600, color: '#7c3aed', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Faculty Portal
          </p>
        </div>

        <ul className="sidebar-nav" style={{ listStyle: 'none', padding: '0 12px', margin: 0 }}>
          {navItems.map((item) => {
            const isActive = activeMenu === item.id;
            return (
              <li
                key={item.id}
                className={isActive ? 'active' : ''}
                onClick={() => {
                  setActiveMenu(item.id);
                  router.push(item.path);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '11px 16px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '14px',
                  marginBottom: '4px',
                  transition: 'all 0.15s ease',
                  backgroundColor: isActive ? '#f5f3ff' : 'transparent',
                  color: isActive ? '#7c3aed' : '#475569',
                }}
              >
                <span style={{ color: isActive ? '#7c3aed' : '#64748b', display: 'flex' }}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </li>
            );
          })}

          <li
            onClick={handleLogout}
            style={{
              marginTop: '28px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '11px 16px',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              color: '#ef4444',
              backgroundColor: '#fff5f5',
              transition: 'all 0.15s ease',
            }}
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </li>
        </ul>
      </div>
    </>
  );
}
