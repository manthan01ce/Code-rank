'use client';
import { FacultyFormDialog } from './FacultyFormDialog';

import LoadingOverlay from '@/components/LoadingOverlay';

import RefreshButton from '@/components/RefreshButton';
import { AdminDataTable } from '@/components/ui/data-table';
import { IconSearch, IconPlus, IconUpload, IconX, IconChevronDown } from '@tabler/icons-react';

import { useFacultyManagement } from '@/features/users/hooks/useFacultyManagement';

export default function FacultyManagement() {
  const state = useFacultyManagement();
  const { authToken, isReady, socket, faculty, setFaculty, pageCursor, setPageCursor, nextCursor, setNextCursor, cursorHistory, setCursorHistory, currentPage, setCurrentPage, requestVersion, activeAbortController, departmentsList, setDepartmentsList, initialLoading, setInitialLoading, fetching, setFetching, processing, setProcessing, searchInput, setSearchInput, debouncedSearch, setDebouncedSearch, statusFilter, setStatusFilter, showModal, setShowModal, editTarget, setEditTarget, formErrors, setFormErrors, toast, setToast, lastUpdated, setLastUpdated, fileRef, form, setForm, token, showToast, fetchFaculty, handleNextPage, handleFirstPage, fetchDepartments, openAdd, openEdit, validateForm, handleSubmit, handleDelete, handleReactivate, handleBulkUpload, columns } = state;
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

      {/* Page Header — Clean, balanced proportions matching Admin Dashboard */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#e2e8f0]">
        <div>
          <h1 className="text-2xl sm:text-[26px] font-bold tracking-tight text-[#0f172a] leading-tight">
            Faculty Master
          </h1>
        </div>

        {/* Primary Action Buttons — Natural content width, aligned heights */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 shrink-0">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#4f46e5] hover:bg-[#4338ca] text-white shadow-xs transition-colors cursor-pointer w-auto"
            onClick={openAdd}
          >
            <IconPlus size={15} />
            <span>Add Faculty Member</span>
          </button>

          <label className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#dbe1ea] bg-white text-[#475569] hover:bg-[#f1f5f9] hover:border-[#cbd5e1] cursor-pointer shadow-xs transition-colors w-auto">
            <IconUpload size={15} className="text-[#4f46e5]" />
            <span>Bulk Upload (Excel/CSV)</span>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              aria-label="Upload faculty spreadsheet"
              onChange={handleBulkUpload}
            />
          </label>

          <RefreshButton
            onRefresh={() => fetchFaculty(pageCursor, false)}
            lastUpdated={lastUpdated}
            label="Refresh"
            variant="default"
          />
        </div>
      </div>

      {/* Integrated Filter Toolbar — Single clean toolbar above the table */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white border border-[#e2e8f0] rounded-xl shadow-xs">
        <div className="relative flex flex-1 items-center max-w-md bg-[#f8fafc] border border-[#dbe1ea] rounded-lg px-3 py-2 focus-within:border-[#4f46e5] focus-within:ring-2 focus-within:ring-[#c7d2fe] transition-all">
          <IconSearch size={16} className="text-[#94a3b8] shrink-0 mr-2" />
          <input
            type="text"
            className="w-full bg-transparent border-0 p-0 text-xs text-[#0f172a] placeholder-[#94a3b8] focus:outline-none"
            aria-label="Search faculty by name, ID, or email"
            placeholder="Search faculty by name, ID, or email…"
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

        <div className="relative inline-block shrink-0">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none text-xs border border-[#dbe1ea] rounded-lg bg-white pl-3.5 pr-8 py-2 text-[#334155] font-medium focus:outline-none focus:border-[#4f46e5] focus:ring-2 focus:ring-[#c7d2fe] cursor-pointer"
            aria-label="Filter by account status"
          >
            <option value="all">All Faculty</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <IconChevronDown
            size={14}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748b] pointer-events-none"
          />
        </div>
      </div>

      {/* Reusable Data Table — With subtle background updating without page reset */}
      <AdminDataTable
        columns={columns}
        data={faculty}
        loading={initialLoading || fetching}
        serverPagination={{
          pageCursor,
          nextCursor,
          onFirstPage: handleFirstPage,
          onNextPage: handleNextPage,
          itemCount: faculty.length,
          loading: fetching,
        }}
        emptyTitle="No faculty members found"
        emptyDescription={
          debouncedSearch
            ? 'No faculty members match your search criteria.'
            : 'No faculty members registered for the selected filter.'
        }
      />

      {/* Add / Edit Modal */}
      <FacultyFormDialog {...state} />
    </div>
  );
}
