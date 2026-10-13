'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, KeyRound, Settings, LogOut, ChevronDown, CheckCircle2, Shield, GraduationCap, School, Edit3 } from 'lucide-react';
import ChangePasswordModal from './ChangePasswordModal';

export default function HeaderProfileDropdown({ user: propUser }) {
  const router = useRouter();
  const [user, setUser] = useState(propUser || null);
  const [isOpen, setIsOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!propUser) {
      const stored = localStorage.getItem('user');
      if (stored) {
        try {
          setUser(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to parse user data:', e);
        }
      }
    } else {
      setUser(propUser);
    }
  }, [propUser]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out?')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      router.push('/');
    }
  };

  if (!user) return null;

  const role = user.role?.toLowerCase() || 'student';
  const userHandle = user.email ? user.email.split('@')[0] : 'user';

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const getRoleBadge = () => {
    switch (role) {
      case 'admin':
        return { label: 'Admin', bg: '#eef2ff', color: '#4338ca', icon: <Shield size={12} /> };
      case 'faculty':
        return { label: 'Faculty', bg: '#f5f3ff', color: '#6d28d9', icon: <School size={12} /> };
      case 'student':
      default:
        return { label: 'Student', bg: '#ecfeff', color: '#0e7490', icon: <GraduationCap size={12} /> };
    }
  };

  const roleBadge = getRoleBadge();
  const avatarBg = role === 'admin' ? '#4f46e5' : role === 'faculty' ? '#7c3aed' : '#0284c7';

  return (
    <>
      <div ref={menuRef} style={{ position: 'relative' }}>
        {/* Trigger Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-haspopup="true"
          aria-expanded={isOpen}
          aria-label="User profile and account settings"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: isOpen ? '#f1f5f9' : 'transparent',
            border: '1px solid',
            borderColor: isOpen ? '#cbd5e1' : 'transparent',
            cursor: 'pointer',
            padding: '6px 10px',
            borderRadius: '10px',
            transition: 'all 0.15s ease',
            outline: 'none'
          }}
          onMouseEnter={(e) => {
            if (!isOpen) e.currentTarget.style.backgroundColor = '#f8fafc';
          }}
          onMouseLeave={(e) => {
            if (!isOpen) e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          {/* Avatar Circle */}
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: avatarBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '14px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
            }}
          >
            {getInitials(user.name)}
          </div>

          {/* User Info Label */}
          <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column' }}>
            <span
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#1e293b',
                lineHeight: 1.2,
                maxWidth: '160px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {user.name || 'User'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  backgroundColor: roleBadge.bg,
                  color: roleBadge.color,
                  padding: '1px 6px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px'
                }}
              >
                {roleBadge.icon}
                {roleBadge.label}
              </span>
            </div>
          </div>

          {/* Dropdown Indicator */}
          <ChevronDown
            size={16}
            style={{
              color: '#64748b',
              marginLeft: '4px',
              transition: 'transform 0.2s',
              transform: isOpen ? 'rotate(180deg)' : 'none'
            }}
          />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div
            role="menu"
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              boxShadow: '0 12px 30px -4px rgba(16, 24, 40, 0.15), 0 4px 6px -2px rgba(16, 24, 40, 0.05)',
              border: '1px solid #e2e8f0',
              minWidth: '230px',
              zIndex: 1000,
              overflow: 'hidden',
              animation: 'fadeIn 0.15s ease'
            }}
          >
            {/* User Details Header */}
            <div
              style={{
                padding: '14px 16px',
                backgroundColor: '#f8fafc',
                borderBottom: '1px solid #e2e8f0'
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                {user.name || 'User'}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: '#64748b',
                  marginTop: '2px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {user.email || ''}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    backgroundColor: roleBadge.bg,
                    color: roleBadge.color,
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}
                >
                  {roleBadge.label} Account
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontSize: '11px',
                    fontWeight: 500,
                    color: '#059669',
                    backgroundColor: '#ecfdf5',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}
                >
                  <CheckCircle2 size={10} /> Active
                </span>
              </div>
            </div>

            {/* Menu Items */}
            <div style={{ padding: '6px' }}>
              {/* My Profile */}
              <button
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  router.push(`/profile/${userHandle}`);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 12px',
                  border: 'none',
                  background: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#1e293b',
                  borderRadius: '6px',
                  transition: 'background-color 0.15s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <User size={16} color="#4f46e5" />
                <span>My Profile</span>
              </button>

              {/* Edit Profile */}
              <button
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  router.push(`/profile/${userHandle}?edit=true`);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 12px',
                  border: 'none',
                  background: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#1e293b',
                  borderRadius: '6px',
                  transition: 'background-color 0.15s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Edit3 size={16} color="#0284c7" />
                <span>Edit Profile</span>
              </button>

              {/* Change Password */}
              <button
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  setIsChangePasswordOpen(true);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 12px',
                  border: 'none',
                  background: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#1e293b',
                  borderRadius: '6px',
                  transition: 'background-color 0.15s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <KeyRound size={16} color="#eab308" />
                <span>Change Password</span>
              </button>

              {/* Admin Settings (if admin) */}
              {role === 'admin' && (
                <button
                  role="menuitem"
                  onClick={() => {
                    setIsOpen(false);
                    router.push('/admin/settings');
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '9px 12px',
                    border: 'none',
                    background: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#1e293b',
                    borderRadius: '6px',
                    transition: 'background-color 0.15s'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <Settings size={16} color="#64748b" />
                  <span>Account Settings</span>
                </button>
              )}

              {/* Divider */}
              <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '6px 0' }} />

              {/* Logout */}
              <button
                role="menuitem"
                onClick={handleLogout}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 12px',
                  border: 'none',
                  background: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#ef4444',
                  borderRadius: '6px',
                  transition: 'background-color 0.15s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fef2f2')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <LogOut size={16} color="#ef4444" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reusable Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </>
  );
}
