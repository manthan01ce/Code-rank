'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import LoadingOverlay from '@/components/LoadingOverlay';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { usePolling } from '@/hooks/usePolling';
import { AdminDataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import {
  IconSearch,
  IconHistory,
  IconRefresh,
  IconClock,
  IconShieldLock,
} from '@tabler/icons-react';

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

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const { token, isReady } = useAdminAuth();

  const fetchLogs = useCallback(async () => {
    try {
      setError('');
      const response = await fetch('/api/logs?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
        return;
      }

      if (!response.ok) throw new Error('Unable to load activity logs');
      const data = await response.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (fetchError) {
      console.error('Fetch activity logs error:', fetchError);
      setError('Unable to load activity logs. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isReady) fetchLogs();
  }, [isReady, fetchLogs]);

  usePolling(fetchLogs, 15_000, isReady);

  // Filter logs locally based on search term & action filter
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchSearch =
        !search.trim() ||
        (log.user_name && log.user_name.toLowerCase().includes(search.toLowerCase())) ||
        (log.action && log.action.toLowerCase().includes(search.toLowerCase())) ||
        (log.details && log.details.toLowerCase().includes(search.toLowerCase()));

      const matchAction =
        actionFilter === 'all' ||
        (actionFilter === 'auth' && (log.action?.includes('LOGIN') || log.action?.includes('PASSWORD') || log.action?.includes('PROFILE'))) ||
        (actionFilter === 'user' && log.action?.includes('USER')) ||
        (actionFilter === 'course' && (log.action?.includes('COURSE') || log.action?.includes('MAP'))) ||
        (actionFilter === 'dept' && log.action?.includes('DEPARTMENT'));

      return matchSearch && matchAction;
    });
  }, [logs, search, actionFilter]);

  // ── TanStack Columns ──
  const columns = useMemo(
    () => [
      {
        accessorKey: 'user_name',
        header: ({ column }) => <DataTableColumnHeader column={column} title="User" />,
        cell: ({ row }) => {
          const userName = row.original.user_name || 'System';
          const initial = userName.charAt(0).toUpperCase();
          return (
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-[#eff1ff] text-[#4338ca] font-bold text-[10px] flex items-center justify-center shrink-0 border border-[#c7d2fe]">
                {initial}
              </span>
              <span className="font-semibold text-[#0f172a]">{userName}</span>
            </div>
          );
        },
      },
      {
        accessorKey: 'action',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Action" />,
        cell: ({ getValue }) => {
          const act = String(getValue() || '');
          const isDanger = act.includes('DELETE') || act.includes('DEACTIVATE');
          const isSuccess = act.includes('CREATE') || act.includes('REACTIVATE');

          return (
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${
                isDanger
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : isSuccess
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-[#eff1ff] text-[#4338ca] border-[#c7d2fe]'
              }`}
            >
              {formatActionLabel(act)}
            </span>
          );
        },
      },
      {
        accessorKey: 'details',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Details" />,
        cell: ({ getValue }) => (
          <span className="text-[#475569] max-w-[420px] block truncate" title={getValue() || ''}>
            {getValue() || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'created_at',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Timestamp" />,
        cell: ({ getValue }) => (
          <span className="inline-flex items-center gap-1.5 text-[#64748b] text-[11px] whitespace-nowrap">
            <IconClock size={13} className="text-[#94a3b8]" />
            {getValue()
              ? new Date(getValue()).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—'}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto">
      {loading && <LoadingOverlay />}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#e2e8f0]">
        <div>
          <div className="text-[10px] font-bold tracking-[1.5px] text-[#4f46e5] uppercase mb-1.5 flex items-center gap-1.5">
            <IconShieldLock size={14} />
            Security & Compliance Audit
          </div>
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#0f172a] leading-tight">
            Activity Logs
          </h1>
          <p className="text-xs sm:text-[13px] text-[#64748b] mt-1 leading-relaxed">
            Immutable log of administrative transactions, login events, and academic updates.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#4f46e5] hover:bg-[#4338ca] text-white shadow-xs transition-colors cursor-pointer"
            onClick={fetchLogs}
          >
            <IconRefresh size={15} />
            <span>Refresh Logs</span>
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs">
          {error}
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 bg-white border border-[#e2e8f0] rounded-[13px] shadow-xs">
        <div className="flex flex-1 items-center gap-2 max-w-md bg-[#f8fafc] border border-[#dbe1ea] rounded-lg px-3 py-1.5 focus-within:border-[#4f46e5] focus-within:ring-2 focus-within:ring-[#c7d2fe]">
          <IconSearch size={16} className="text-[#94a3b8] shrink-0" />
          <input
            type="text"
            className="w-full bg-transparent border-0 p-0 text-xs text-[#0f172a] placeholder-[#94a3b8] focus:outline-none"
            aria-label="Search activity logs"
            placeholder="Search by user, action, or details…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="text-xs border border-[#dbe1ea] rounded-lg bg-white px-3 py-2 text-[#475569] font-medium focus:outline-none focus:border-[#4f46e5]"
            aria-label="Filter by action category"
          >
            <option value="all">All Action Categories</option>
            <option value="auth">Authentication & Passwords</option>
            <option value="user">User Management</option>
            <option value="course">Courses & Mapping</option>
            <option value="dept">Departments</option>
          </select>
        </div>
      </div>

      {/* Reusable Data Table */}
      <AdminDataTable
        columns={columns}
        data={filteredLogs}
        loading={loading}
        pageSize={15}
        emptyTitle="No activity logs found"
        emptyDescription={search ? "No logs match your filter criteria." : "No administrative actions have been logged yet."}
      />
    </div>
  );
}
