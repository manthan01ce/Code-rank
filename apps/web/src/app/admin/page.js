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
import { useAdminAuth } from '@/hooks/useAdminAuth';
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

export default function AdminDashboard() {
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

  return (
    <div className="max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-[#e2e8f0] mb-6">
        <div>
          <div className="text-[10px] font-bold tracking-[1.5px] text-[#4f46e5] uppercase mb-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4f46e5] inline-block animate-pulse"></span>
            Institution Workspace
          </div>
          <h1 className="text-2xl sm:text-[26px] font-bold tracking-tight text-[#0f172a] leading-tight">
            Dashboard Overview
          </h1>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            className="btn-primary inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-[#4f46e5] hover:bg-[#4338ca] text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              fetchDashboardData();
            }}
          >
            <IconRefresh size={14} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Refreshing…' : 'Refresh Overview'}</span>
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs flex items-center justify-between gap-3 mb-6">
          <span>{error}{data && ' (Showing cached data)'}</span>
          <button
            type="button"
            onClick={() => { setLoading(true); fetchDashboardData(); }}
            className="text-xs font-semibold text-red-700 underline hover:text-red-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* 1. Statistics Cards — Proportionally balanced (~10-15% height reduction), labels top-left, values below, icons top-right */}
      <section aria-label="Key Performance Indicators" className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5" aria-busy={loading}>
          {cards.map(([key, label, href, Icon]) => (
            <Link
              key={key}
              href={href}
              className="group block p-5 sm:p-5.5 bg-white border border-[#e2e8f0] rounded-xl min-h-[120px] sm:min-h-[128px] hover:border-[#a5b4fc] hover:shadow-xs transition-all duration-200 no-underline focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-2.5">
                  <span className="text-[11px] sm:text-[12px] font-semibold text-[#64748b] uppercase tracking-wider">
                    {label}
                  </span>
                  <strong className="text-3xl sm:text-[34px] font-bold tracking-tight text-[#0f172a] leading-none">
                    {data ? (
                      <AnimatedNumber value={data.stats[key]} />
                    ) : (
                      <span className="inline-block w-16 h-8 bg-[#f1f5f9] rounded-md animate-pulse"></span>
                    )}
                  </strong>
                </div>

                <div className="w-10 h-10 rounded-lg bg-[#eff1ff] text-[#4f46e5] flex items-center justify-center group-hover:bg-[#4f46e5] group-hover:text-white transition-colors duration-150 shrink-0">
                  <Icon size={20} aria-hidden="true" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 2. Quick Actions — Clean horizontal cards: Icon -> Title -> Arrow at far right */}
      <section aria-labelledby="quick-actions-title" className="mb-6">
        <h2 id="quick-actions-title" className="text-sm sm:text-base font-bold text-[#0f172a] mb-3 sm:mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {quickActions.map((action) => {
            const ActionIcon = action.icon;
            return (
              <Link
                key={action.href + action.label}
                href={action.href}
                className="group flex min-h-[82px] sm:min-h-[86px] items-center gap-3.5 sm:gap-4 p-4 sm:p-5 bg-white border border-[#e2e8f0] rounded-xl hover:border-[#a5b4fc] hover:shadow-xs focus:border-[#a5b4fc] focus:shadow-xs transition-all duration-150 ease-out no-underline focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
              >
                <div className="w-10 h-10 rounded-lg bg-[#eff1ff] text-[#4f46e5] flex items-center justify-center shrink-0 group-hover:bg-[#4f46e5] group-hover:text-white transition-colors duration-150">
                  <ActionIcon size={19} aria-hidden="true" />
                </div>
                <span className="text-[13px] sm:text-[14px] font-semibold text-[#0f172a] group-hover:text-[#4338ca] transition-colors duration-150 leading-tight">
                  {action.label}
                </span>
                <IconArrowUpRight
                  size={16}
                  style={{ marginLeft: 'auto' }}
                  className="ml-auto text-[#94a3b8] group-hover:text-[#4f46e5] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-150 shrink-0"
                />
              </Link>
            );
          })}
        </div>
      </section>

      {/* 3. Recent Activity — Separated and Compact */}
      <section aria-labelledby="recent-activity-title" className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#f1f5f9]">
          <h2 id="recent-activity-title" className="text-sm sm:text-base font-bold text-[#0f172a]">
            Recent Activity
          </h2>
          <Link
            href="/admin/logs"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#4f46e5] hover:text-[#4338ca] no-underline focus:outline-none focus:underline"
          >
            View All Logs
            <IconArrowUpRight size={13} />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#edf0f5] text-[10px] uppercase tracking-wider text-[#64748b]">
                <th scope="col" className="py-2.5 px-3 font-bold">User</th>
                <th scope="col" className="py-2.5 px-3 font-bold">Action</th>
                <th scope="col" className="py-2.5 px-3 font-bold hidden sm:table-cell">Details</th>
                <th scope="col" className="py-2.5 px-3 font-bold text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {loading && !data && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-[#64748b]">
                    <div className="inline-flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-[#4f46e5] border-t-transparent rounded-full animate-spin"></span>
                      <span>Loading activity…</span>
                    </div>
                  </td>
                </tr>
              )}

              {data?.logs?.slice(0, 5).map((log) => {
                const initial = (log.user_name || 'System').charAt(0).toUpperCase();
                const act = String(log.action || '').toUpperCase();
                const isDanger = act.includes('DELETE') || act.includes('DEACTIVATE');
                const isSuccess = act.includes('CREATE') || act.includes('REACTIVATE');
                return (
                  <tr key={log.id} className="hover:bg-[#fafbfe] transition-colors duration-150">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-[#eff1ff] text-[#4338ca] font-bold text-[10px] flex items-center justify-center shrink-0 border border-[#c7d2fe]">
                          {initial}
                        </span>
                        <span className="font-semibold text-[#0f172a] truncate max-w-[140px]">
                          {log.user_name || 'System'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                          isDanger
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : isSuccess
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-[#eff1ff] text-[#4338ca] border border-[#c7d2fe]'
                        }`}
                      >
                        {formatActionLabel(log.action)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[#475569] max-w-[280px] truncate hidden sm:table-cell" title={log.details}>
                      {log.details || '—'}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap text-[#64748b] text-[11px]">
                      <span className="inline-flex items-center gap-1.5" title={new Date(log.created_at).toLocaleString()}>
                        <IconClock size={12} className="text-[#94a3b8]" />
                        {formatRelativeTime(log.created_at)}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {data && data.logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-[#94a3b8] italic">
                    No recent activity recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
