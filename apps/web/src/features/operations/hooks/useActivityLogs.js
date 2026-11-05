'use client';
import { createRequestScope } from '@/lib/client/http-client';
import { logsRequest } from '../api/operations-api';

import { useCallback, useEffect, useState, useMemo } from 'react';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import { useAdminAuth } from '@/features/auth/hooks/useAdminAuth';
import { usePolling } from '@/hooks/usePolling';
import { AdminDataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import {
  IconSearch,
  IconHistory,
  IconRefresh,
  IconClock,
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

export function useActivityLogs() {
  const [listRequests] = useState(createRequestScope);
  useEffect(() => () => listRequests.cancel(), [listRequests]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const { token, isReady } = useAdminAuth();

  const fetchLogs = useCallback(async () => {
    const request = listRequests.begin();
    try {
      setError('');
      const response = await logsRequest(100, {
        headers: { Authorization: `Bearer ${token}` }, signal: request.signal,
      });

      if (!request.isCurrent()) return;
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
        return;
      }

      if (!response.ok) throw new Error('Unable to load activity logs');
      const data = await response.json();
      if (!request.isCurrent()) return;
      setLogs(Array.isArray(data) ? data : []);
    } catch (fetchError) {
      if (!request.isCurrent()) return;
      console.error('Fetch activity logs error:', fetchError);
      setError('Unable to load activity logs. Please try again.');
    } finally {
      if (request.isCurrent()) setLoading(false);
    }
  }, [token, listRequests]);

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


  return { logs, setLogs, loading, setLoading, error, setError, search, setSearch, actionFilter, setActionFilter, token, isReady, fetchLogs, filteredLogs, columns };
}

export { formatActionLabel };
