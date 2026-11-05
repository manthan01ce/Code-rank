'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchCollection } from '@/lib/client/fetch-collection';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import { useAdminAuth } from '@/features/auth/hooks/useAdminAuth';
import { useSocket } from '@/hooks/useSocket';
import RefreshButton from '@/components/ui/RefreshButton';
import { AdminDataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import {
  IconSearch,
  IconPlus,
  IconEdit,
  IconTrash,
  IconBuilding,
  IconCalendar,
  IconX,
  IconAlertTriangle,
  IconAlertCircle,
} from '@tabler/icons-react';
import { useDepartmentsManagement } from '@/features/courses/hooks/useDepartmentsManagement';

export default function DepartmentMaster() {
  const { socket, departments, setDepartments, loading, setLoading, fetching, setFetching, processing, setProcessing, searchInput, setSearchInput, debouncedSearch, setDebouncedSearch, showModal, setShowModal, editTarget, setEditTarget, form, setForm, formErrors, setFormErrors, modalError, setModalError, deleteTarget, setDeleteTarget, deleting, setDeleting, deleteError, setDeleteError, toast, setToast, lastUpdated, setLastUpdated, authToken, isReady, token, showToast, isFormDirty, handleCloseModal, fetchDepartments, openAdd, openEdit, handleSubmit, confirmDelete, columns } = useDepartmentsManagement();
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
            Department Master
          </h1>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 flex-wrap">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#4f46e5] hover:bg-[#4338ca] text-white shadow-xs transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#4f46e5] focus:ring-offset-1 shrink-0 w-auto"
            onClick={openAdd}
          >
            <IconPlus size={15} />
            <span>Add Department</span>
          </button>

          <RefreshButton
            onRefresh={() => fetchDepartments(false)}
            lastUpdated={lastUpdated}
            label="Refresh"
            variant="default"
          />
        </div>
      </div>

      {/* Integrated Filter Toolbar */}
      <div className="flex items-center justify-between gap-3 p-3 bg-white border border-[#e2e8f0] rounded-xl shadow-xs">
        <div className="relative flex flex-1 items-center max-w-md bg-[#f8fafc] border border-[#dbe1ea] rounded-lg px-3 py-2 focus-within:border-[#4f46e5] focus-within:ring-2 focus-within:ring-[#c7d2fe] transition-all">
          <IconSearch size={16} className="text-[#94a3b8] shrink-0 mr-2" />
          <input
            type="text"
            className="w-full bg-transparent border-0 p-0 text-xs text-[#0f172a] placeholder-[#94a3b8] focus:outline-none"
            aria-label="Search departments or institutes"
            placeholder="Search departments or institutes…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              className="text-[#94a3b8] hover:text-[#0f172a] p-0.5 rounded transition-colors focus:outline-none cursor-pointer"
              aria-label="Clear search"
            >
              <IconX size={14} />
            </button>
          )}
        </div>

        <div className="text-xs text-[#64748b] font-medium hidden sm:block">
          <span className="font-semibold text-[#0f172a]">{departments.length}</span> departments listed
        </div>
      </div>

      {/* Reusable Data Table — With subtle background updating without page reset */}
      <AdminDataTable
        columns={columns}
        data={departments}
        loading={loading}
        pageSize={10}
        emptyTitle="No departments found"
        emptyDescription={
          debouncedSearch ? 'No departments match your search query.' : 'No academic departments registered yet.'
        }
      />

      {/* Add / Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-[#0f172a]/45 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={handleCloseModal}
        >
          <div
            className="bg-white rounded-2xl p-6 sm:p-7 w-full max-w-md shadow-2xl border border-[#e2e8f0] max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dept-modal-title"
          >
            <div className="flex items-start justify-between mb-4 pb-3 border-b border-[#f1f5f9]">
              <div>
                <h2 id="dept-modal-title" className="text-lg font-bold text-[#0f172a] leading-snug">
                  {editTarget ? `Edit ${editTarget.name}` : 'Add New Department'}
                </h2>
                <p className="text-xs text-[#64748b] mt-0.5">
                  {editTarget
                    ? 'Update the department name or institute affiliation.'
                    : 'Create a new department under an institute.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-[#94a3b8] hover:text-[#0f172a] p-1 rounded-lg hover:bg-[#f1f5f9] transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <IconX size={18} />
              </button>
            </div>

            {modalError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <IconAlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#334155] mb-1">
                  Department Name <span className="text-red-500">*</span>
                </label>
                <input
                  aria-label="Department Name"
                  placeholder="e.g. CSE"
                  value={form.name}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, name: e.target.value }));
                    if (formErrors.name) setFormErrors((errs) => ({ ...errs, name: null }));
                  }}
                  className={`w-full text-xs border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 transition-all ${
                    formErrors.name
                      ? 'border-red-300 focus:ring-red-200 focus:border-red-500'
                      : 'border-[#dbe1ea] focus:ring-[#c7d2fe] focus:border-[#4f46e5]'
                  }`}
                />
                {formErrors.name && (
                  <p className="text-[11px] text-red-600 mt-1 font-medium">{formErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#334155] mb-1">
                  Institute Name <span className="text-red-500">*</span>
                </label>
                <input
                  aria-label="Institute Name"
                  placeholder="e.g. CSPIT"
                  value={form.institute_name}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, institute_name: e.target.value }));
                    if (formErrors.institute_name) {
                      setFormErrors((errs) => ({ ...errs, institute_name: null }));
                    }
                  }}
                  className={`w-full text-xs border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 transition-all ${
                    formErrors.institute_name
                      ? 'border-red-300 focus:ring-red-200 focus:border-red-500'
                      : 'border-[#dbe1ea] focus:ring-[#c7d2fe] focus:border-[#4f46e5]'
                  }`}
                />
                {formErrors.institute_name && (
                  <p className="text-[11px] text-red-600 mt-1 font-medium">
                    {formErrors.institute_name}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-[#f1f5f9]">
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 text-xs font-semibold rounded-lg bg-[#4f46e5] hover:bg-[#4338ca] text-white shadow-xs cursor-pointer disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-[#4f46e5] focus:ring-offset-1"
                  disabled={processing}
                >
                  {processing ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Department'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={processing}
                  className="flex-1 py-2 px-4 text-xs font-semibold rounded-lg border border-[#dbe1ea] bg-white text-[#475569] hover:bg-[#f1f5f9] cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-[#c7d2fe] disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 bg-[#0f172a]/45 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 sm:p-7 w-full max-w-md shadow-2xl border border-[#e2e8f0]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dept-title"
            aria-describedby="delete-dept-description"
          >
            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
                <IconAlertTriangle size={20} />
              </div>
              <div>
                <h2 id="delete-dept-title" className="text-base font-bold text-[#0f172a] leading-snug">
                  Delete Department?
                </h2>
                <p id="delete-dept-description" className="text-xs text-[#64748b] mt-1 leading-relaxed">
                  Are you sure you want to delete{' '}
                  <strong className="text-[#0f172a] font-semibold">{deleteTarget.name}</strong>? This
                  action cannot be undone.
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 leading-relaxed flex items-start gap-2">
                <IconAlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#f1f5f9]">
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError(null);
                }}
                disabled={deleting}
                className="py-2 px-4 text-xs font-semibold rounded-lg border border-[#dbe1ea] bg-white text-[#475569] hover:bg-[#f1f5f9] cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-[#c7d2fe] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="py-2 px-4 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-xs cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete Department'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
