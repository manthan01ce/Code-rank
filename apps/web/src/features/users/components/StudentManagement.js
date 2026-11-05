'use client';
import { StudentFormDialog } from './StudentFormDialog';

import LoadingOverlay from '@/components/LoadingOverlay';

import RefreshButton from '@/components/RefreshButton';
import { AdminDataTable } from '@/components/ui/data-table';
import { IconSearch, IconPlus, IconUpload, IconX, IconChevronDown } from '@tabler/icons-react';

import { useStudentManagement } from '@/features/users/hooks/useStudentManagement';

export default function StudentManagement() {
  const state = useStudentManagement();
  const { authToken, isReady, socket, students, setStudents, pageCursor, setPageCursor, nextCursor, setNextCursor, requestVersion, activeAbortController, departmentsList, setDepartmentsList, loading, setLoading, fetching, setFetching, processing, setProcessing, searchInput, setSearchInput, debouncedSearch, setDebouncedSearch, statusFilter, setStatusFilter, divisionFilter, setDivisionFilter, showModal, setShowModal, editTarget, setEditTarget, toast, setToast, lastUpdated, setLastUpdated, fileRef, form, setForm, token, showToast, validateDivision, fetchStudents, fetchDepartments, openAdd, openEdit, handleSubmit, handleDelete, handleReactivate, handleBulkUpload, columns } = state;
return (
    <div className="space-y-6 max-w-[1440px] mx-auto">
      {processing && <LoadingOverlay />}

      {/* Toast Feedback */}
      {toast && (
        <div
          role="status"
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-lg shadow-lg text-xs font-semibold flex items-center gap-2 border transition-all ${
            toast.type === 'success'
              ? 'bg-[#eff1ff] text-[#4338ca] border-[#c7d2fe]'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#e2e8f0]">
        <div>
          <h1 className="text-2xl sm:text-[26px] font-bold tracking-tight text-[#0f172a] leading-tight">
            Student Master
          </h1>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 shrink-0">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#4f46e5] hover:bg-[#4338ca] text-white shadow-xs transition-colors cursor-pointer w-auto"
            onClick={openAdd}
            aria-label="+ Add Student"
          >
            <IconPlus size={15} />
            <span>Add Student</span>
          </button>

          <label className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#dbe1ea] bg-white text-[#475569] hover:bg-[#f1f5f9] hover:border-[#cbd5e1] cursor-pointer shadow-xs transition-colors w-auto">
            <IconUpload size={15} className="text-[#4f46e5]" />
            <span>Bulk Upload (Excel/CSV)</span>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              aria-label="Upload enrollment spreadsheet"
              onChange={handleBulkUpload}
            />
          </label>

          <RefreshButton onRefresh={() => fetchStudents(null, false)} lastUpdated={lastUpdated} label="Refresh" variant="default" />
        </div>
      </div>

      {/* Integrated Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white border border-[#e2e8f0] rounded-xl shadow-xs">
        <div className="relative flex flex-1 items-center max-w-md bg-[#f8fafc] border border-[#dbe1ea] rounded-lg px-3 py-2 focus-within:border-[#4f46e5] focus-within:ring-2 focus-within:ring-[#c7d2fe] transition-all">
          <IconSearch size={16} className="text-[#94a3b8] shrink-0 mr-2" />
          <input
            type="text"
            className="w-full bg-transparent border-0 p-0 text-xs text-[#0f172a] placeholder-[#94a3b8] focus:outline-none"
            aria-label="Search student by name, roll, email, or division"
            placeholder="Search by name, roll, email, or division…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              className="text-[#94a3b8] hover:text-[#0f172a] p-0.5 rounded transition-colors focus:outline-none"
              aria-label="Clear search"
            >
              <IconX size={14} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative inline-block">
            <select
              value={divisionFilter}
              onChange={(e) => setDivisionFilter(e.target.value)}
              className="appearance-none text-xs border border-[#dbe1ea] rounded-lg bg-white pl-3.5 pr-8 py-2 text-[#334155] font-medium focus:outline-none focus:border-[#4f46e5] focus:ring-2 focus:ring-[#c7d2fe] cursor-pointer"
              aria-label="Filter by student division"
            >
              <option value="all">All Divisions</option>
              <option value="CE1">CE1</option>
              <option value="CE2">CE2</option>
              <option value="IT1">IT1</option>
              <option value="IT2">IT2</option>
              <option value="CSE1">CSE1</option>
              <option value="CSE2">CSE2</option>
            </select>
            <IconChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748b] pointer-events-none" />
          </div>

          <div className="relative inline-block">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none text-xs border border-[#dbe1ea] rounded-lg bg-white pl-3.5 pr-8 py-2 text-[#334155] font-medium focus:outline-none focus:border-[#4f46e5] focus:ring-2 focus:ring-[#c7d2fe] cursor-pointer"
              aria-label="Filter by account status"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
            <IconChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748b] pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Reusable Data Table */}
      <AdminDataTable
        columns={columns}
        data={students}
        loading={loading || fetching}
        serverPagination={{
          pageCursor,
          nextCursor,
          onFirstPage: () => fetchStudents(null, true),
          onNextPage: (cursor) => fetchStudents(cursor, false),
          itemCount: students.length,
          loading: fetching,
        }}
        emptyTitle="No students found"
        emptyDescription={debouncedSearch ? 'No student matches your current search criteria.' : 'No students registered under the selected filters.'}
      />

      {/* Add / Edit Modal */}
      <StudentFormDialog {...state} />
    </div>
  );
}
