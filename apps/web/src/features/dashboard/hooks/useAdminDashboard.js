'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  IconSchool,
  IconUsers,
  IconBook,
  IconArrowsShuffle,
  IconBuilding,
  IconHistory,
  IconRefresh,
  IconArrowUpRight,
  IconUserPlus,
  IconPlus,
  IconClock,
} from '@tabler/icons-react';
import { useAdminAuth } from '@/features/auth/hooks/useAdminAuth';
import { usePolling } from '@/hooks/usePolling';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';

const cards = [
  ['faculty', 'Faculty Members', '/admin/faculty', IconUsers],
  ['students', 'Students Enrolled', '/admin/students', IconSchool],
  ['courses', 'Active Courses', '/admin/courses', IconBook],
];

const quickActions = [
  { label: 'Add Student', href: '/admin/students', icon: IconUserPlus },
  { label: 'Add Faculty', href: '/admin/faculty', icon: IconPlus },
  { label: 'Create Course', href: '/admin/courses', icon: IconBook },
  { label: 'Map Courses', href: '/admin/mapping', icon: IconArrowsShuffle },
  { label: 'Manage Departments', href: '/admin/departments', icon: IconBuilding },
  { label: 'Audit Activity', href: '/admin/logs', icon: IconHistory },
];

function formatActionLabel(rawAction) {
  if (!rawAction) return 'Activity';
  const clean = String(rawAction).toUpperCase().trim();
  const map = {
    LOGIN: 'Sign In',
    LOGOUT: 'Sign Out',
    CREATE_USER: 'User Created',
    UPDATE_USER: 'User Updated',
    DEACTIVATE_USER: 'User Deactivated',
    REACTIVATE_USER: 'User Reactivated',
    UPDATE_PROFILE: 'Profile Updated',
    CHANGE_PASSWORD: 'Password Changed',
    CREATE_COURSE: 'Course Added',
    UPDATE_COURSE: 'Course Updated',
    DELETE_COURSE: 'Course Deleted',
    CREATE_DEPARTMENT: 'Department Added',
    UPDATE_DEPARTMENT: 'Department Updated',
    DELETE_DEPARTMENT: 'Department Deleted',
    MAP_FACULTY: 'Faculty Mapped',
  };
  return map[clean] || clean.replace(/_/g, ' ');
}

function formatRelativeTime(dateString) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function useAdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const { token, isReady } = useAdminAuth();

  const fetchDashboardData = useCallback(() => {
    if (!token) return Promise.resolve();
    return Promise.all([
      fetch('/api/stats', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
      fetch('/api/logs?limit=5', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
    ])
      .then(async ([statsResponse, logsResponse]) => {
        if ([statsResponse.status, logsResponse.status].some((status) => status === 401 || status === 403)) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          router.replace('/login');
          return;
        }
        if (!statsResponse.ok || !logsResponse.ok) {
          throw new Error('Unable to load dashboard data. Please refresh to try again.');
        }
        const [stats, logs] = await Promise.all([statsResponse.json(), logsResponse.json()]);
        if (!Array.isArray(logs) || !cards.every(([key]) => Number.isInteger(stats[key]) && stats[key] >= 0)) {
          throw new Error('Dashboard data is incomplete. Please refresh to try again.');
        }
        setData({ stats, logs });
        setError('');
      })
      .catch((err) => setError(err.message || 'Unable to load dashboard.'))
      .finally(() => setLoading(false));
  }, [token, router]);

  useEffect(() => {
    if (isReady) fetchDashboardData();
  }, [isReady, fetchDashboardData]);

  usePolling(fetchDashboardData, 15_000, isReady);


  return { router, data, setData, error, setError, loading, setLoading, token, isReady, fetchDashboardData };
}

export { cards, quickActions, formatActionLabel, formatRelativeTime };
