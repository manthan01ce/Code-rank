"use client";

import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  IconLayoutDashboard,
  IconBuilding,
  IconUsers,
  IconSchool,
  IconBook,
  IconArrowsShuffle,
  IconHistory,
  IconSettings,
  IconLogout,
  IconUser,
  IconKey,
} from '@tabler/icons-react';
import { Sidebar, SidebarBody, SidebarLink, useSidebar } from '@/components/ui/sidebar';
import { useAccountIdentity } from '@/features/auth/hooks/useAccountIdentity';
import ChangePasswordModal from '@/features/auth/components/ChangePasswordModal';
import LogoutConfirmModal from './LogoutConfirmModal';

// Preserving the exact existing admin destinations and labels
const links = [
  ['Dashboard', '/admin', IconLayoutDashboard],
  ['Department Master', '/admin/departments', IconBuilding],
  ['Faculty Master', '/admin/faculty', IconUsers],
  ['Student Master', '/admin/students', IconSchool],
  ['Courses', '/admin/courses', IconBook],
  ['Course Mapping', '/admin/mapping', IconArrowsShuffle],
  ['Activity Logs', '/admin/logs', IconHistory],
  ['Settings', '/admin/settings', IconSettings],
];

function AdminSidebarInner() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAccountIdentity();
  const { collapseOnNav } = useSidebar();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.replace('/login');
    }
  }, [user, router]);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  const userInitial = user?.name?.charAt(0).toUpperCase() || 'A';
  const userName = user?.name || 'Admin';

  return (
    <>
      <SidebarBody>
        {/* Brand Header */}
        <Link
          href="/admin"
          aria-label="CodeRank Admin Panel"
          className="admin-brand"
          onClick={(e) => {
            e.currentTarget?.blur?.();
            collapseOnNav(e);
          }}
        >
          <img
            src="/coderank-logo.jpg"
            alt="CodeRank"
            className="w-8 h-8 rounded-full object-cover shrink-0 border border-[#e2e8f0]"
          />
          <div className="admin-brand-text">
            <span className="font-bold text-[#0f172a] text-sm leading-tight tracking-tight">CodeRank</span>
            <span className="text-[10px] text-[#64748b] font-semibold uppercase tracking-wider">Admin Panel</span>
          </div>
        </Link>

        {/* Navigation */}
        <nav aria-label="Administration">
          {links.map(([label, href, Icon]) => (
            <SidebarLink
              key={href}
              href={href}
              label={label}
              icon={<Icon size={19} />}
              active={pathname === href}
            />
          ))}
        </nav>

        {/* Account Section: Identity, Profile, Password, Logout */}
        <div className="admin-account">
          {/* Identity */}
          <div className="admin-nav-item">
            <div className="admin-identity">
              <span className="admin-identity-badge" aria-hidden="true">
                {userInitial}
              </span>
              <div className="admin-identity-info">
                <span className="text-xs font-semibold text-[#0f172a] truncate">{userName}</span>
                <span className="text-[9px] text-[#64748b] font-medium tracking-wide">ADMIN</span>
              </div>
            </div>
            <div role="tooltip" className="admin-sidebar-tooltip">
              {userName} (Admin)
            </div>
          </div>

          {/* Profile */}
          <SidebarLink
            href="/admin/profile"
            label="Profile"
            icon={<IconUser size={19} />}
            active={pathname === '/admin/profile' || pathname.startsWith('/profile/')}
          />

          {/* Change Password */}
          <div className="admin-nav-item">
            <button
              type="button"
              aria-label="Change Password"
              onClick={(e) => {
                e.currentTarget?.blur?.();
                collapseOnNav(e);
                setPasswordOpen(true);
              }}
              className="admin-account-btn"
            >
              <span className="admin-nav-icon text-[#4f46e5]">
                <IconKey size={19} />
              </span>
              <span className="admin-sidebar-label">Change Password</span>
            </button>
            <div role="tooltip" className="admin-sidebar-tooltip">
              Change Password
            </div>
          </div>

          {/* Logout */}
          <div className="admin-nav-item">
            <button
              type="button"
              aria-label="Logout"
              onClick={(e) => {
                e.currentTarget?.blur?.();
                collapseOnNav(e);
                setLogoutOpen(true);
              }}
              className="admin-account-btn btn-logout"
            >
              <span className="admin-nav-icon text-[#dc2626]">
                <IconLogout size={19} />
              </span>
              <span className="admin-sidebar-label">Logout</span>
            </button>
            <div role="tooltip" className="admin-sidebar-tooltip">
              Logout
            </div>
          </div>
        </div>
      </SidebarBody>

      <ChangePasswordModal isOpen={passwordOpen} onClose={() => setPasswordOpen(false)} />
      <LogoutConfirmModal isOpen={logoutOpen} onConfirm={logout} onCancel={() => setLogoutOpen(false)} />
    </>
  );
}

export default function AdminSidebar() {
  return (
    <Sidebar>
      <AdminSidebarInner />
    </Sidebar>
  );
}
