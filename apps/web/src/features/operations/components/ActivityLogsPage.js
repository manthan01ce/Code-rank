'use client';
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
import { useActivityLogs, formatActionLabel } from '@/features/operations/hooks/useActivityLogs';

export default function ActivityLogsPage() {
  const { logs, setLogs, loading, setLoading, error, setError, search, setSearch, actionFilter, setActionFilter, token, isReady, fetchLogs, filteredLogs, columns } = useActivityLogs();
return (
    <div className="space-y-6 max-w-[1440px] mx-auto">
      {loading && <LoadingOverlay />}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#e2e8f0]">
        <div>
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
