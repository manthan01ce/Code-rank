'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { 
  LayoutDashboard, 
  Building2, 
  GraduationCap, 
  Users, 
  BookOpen, 
  Network, 
  ScrollText, 
  Settings, 
  LogOut 
} from 'lucide-react';
import HeaderProfileDropdown from './HeaderProfileDropdown';
import NotificationDropdown from './NotificationDropdown';

export default function AdminSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const parsed = JSON.parse(userData);
        if (parsed.role !== 'admin') {
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

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      router.push('/');
    }
  };

  const navItems = [
    { label: 'Dashboard', path: '/admin', icon: <LayoutDashboard size={18} /> },
    { label: 'Department Master', path: '/admin/departments', icon: <Building2 size={18} /> },
    { label: 'Faculty Master', path: '/admin/faculty', icon: <Users size={18} /> },
    { label: 'Student Master', path: '/admin/students', icon: <GraduationCap size={18} /> },
    { label: 'Courses', path: '/admin/courses', icon: <BookOpen size={18} /> },
    { label: 'Course Mapping', path: '/admin/mapping', icon: <Network size={18} /> },
    { label: 'Activity Logs', path: '/admin/logs', icon: <ScrollText size={18} /> },
    { label: 'Settings', path: '/admin/settings', icon: <Settings size={18} /> },
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
      <div className="sidebar" style={{ paddingTop: '20px', zIndex: 99 }}>
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
          <p style={{ fontSize: '11px', fontWeight: 600, color: '#6366f1', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Administration
          </p>
        </div>

        <ul className="sidebar-nav" style={{ listStyle: 'none', padding: '0 12px', margin: 0 }}>
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <li
                key={item.path}
                className={isActive ? 'active' : ''}
                onClick={() => router.push(item.path)}
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
                  backgroundColor: isActive ? '#eef2ff' : 'transparent',
                  color: isActive ? '#4f46e5' : '#475569',
                }}
              >
                <span style={{ color: isActive ? '#4f46e5' : '#64748b', display: 'flex' }}>
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
