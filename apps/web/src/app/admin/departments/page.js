'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchCollection } from '@/lib/fetch-collection';
import LoadingOverlay from '@/components/LoadingOverlay';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useSocket } from '@/hooks/useSocket';
import RefreshButton from '@/components/RefreshButton';
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

export default function DepartmentMaster() {
  const socket = useSocket();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Decouple typed input from debounced query to prevent typing lag and layout flicker
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Add / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ name: '', institute_name: '' });
  const [formErrors, setFormErrors] = useState({});
  const [modalError, setModalError] = useState(null);

  // Dedicated Delete Confirmation Dialog State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const [toast, setToast] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const { token: authToken, isReady } = useAdminAuth();
  const token = useCallback(() => {
    return (typeof window !== 'undefined' ? localStorage.getItem('token') : null) || authToken || '';
  }, [authToken]);

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 5000);
  }, []);

  // Check if Add/Edit form has unsaved modifications
  const isFormDirty = useMemo(() => {
    if (!showModal) return false;
    const initialName = editTarget ? editTarget.name || '' : '';
    const initialInstitute = editTarget ? editTarget.institute_name || '' : '';
    return form.name !== initialName || form.institute_name !== initialInstitute;
  }, [showModal, editTarget, form]);

  // Safe dismiss for Add/Edit Modal
  const handleCloseModal = useCallback(() => {
    if (processing) return;
    if (isFormDirty) {
      if (!window.confirm('You have unsaved changes. Discard changes and close?')) {
        return;
      }
    }
    setShowModal(false);
    setEditTarget(null);
    setForm({ name: '', institute_name: '' });
    setFormErrors({});
    setModalError(null);
  }, [processing, isFormDirty]);

  // ── Debounce search input (300ms) ──
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // ── Fetch Departments (background refresh preserves table state) ──
  const fetchDepartments = useCallback(
    async (isInitial = false) => {
      if (!authToken) return;
      if (isInitial) {
        setLoading(true);
      } else {
        setFetching(true);
      }
      try {
        let url = '/api/departments';
        if (debouncedSearch) url += `?search=${encodeURIComponent(debouncedSearch)}`;
        const rows = await fetchCollection(url, { headers: { Authorization: `Bearer ${token()}` } });
        setDepartments(Array.isArray(rows) ? rows : []);
        setLastUpdated(new Date());
      } catch (e) {
        console.error('Failed to fetch departments:', e);
        if (isInitial) setDepartments([]);
        showToast('error', 'Failed to fetch departments');
      } finally {
        setLoading(false);
        setFetching(false);
      }
    },
    [authToken, debouncedSearch, token, showToast]
  );

  // Initial load
  useEffect(() => {
    if (isReady) fetchDepartments(true);
  }, [isReady]);

  // Re-fetch when debounced search query changes (background update)
  useEffect(() => {
    if (isReady) fetchDepartments(false);
  }, [debouncedSearch]);

  // Real-time WebSocket synchronization
  useEffect(() => {
    if (!socket) return;
    socket.emit('join_admin_room');

    const handleDeptEvent = () => fetchDepartments(false);

    socket.on('department_added', handleDeptEvent);
    socket.on('department_updated', handleDeptEvent);
    socket.on('department_deleted', handleDeptEvent);
    socket.on('admin_stats_changed', handleDeptEvent);

    return () => {
      socket.off('department_added', handleDeptEvent);
      socket.off('department_updated', handleDeptEvent);
      socket.off('department_deleted', handleDeptEvent);
      socket.off('admin_stats_changed', handleDeptEvent);
    };
  }, [socket, fetchDepartments]);

  // Keyboard accessibility for modals (Escape closes when safe)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (deleteTarget && !deleting) {
          setDeleteTarget(null);
          setDeleteError(null);
        } else if (showModal && !processing) {
          handleCloseModal();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal, processing, handleCloseModal, deleteTarget, deleting]);

  const openAdd = () => {
    setEditTarget(null);
    setForm({ name: '', institute_name: '' });
    setFormErrors({});
    setModalError(null);
    setShowModal(true);
  };

  const openEdit = (d) => {
    setEditTarget(d);
    setForm({
      name: d.name || '',
      institute_name: d.institute_name || '',
    });
    setFormErrors({});
    setModalError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError(null);

    const trimmedName = form.name.trim();
    const trimmedInstitute = form.institute_name.trim();

    const errors = {};
    if (!trimmedName) errors.name = 'Department Name is required';
    if (!trimmedInstitute) errors.institute_name = 'Institute Name is required';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setProcessing(true);
    try {
      if (editTarget) {
        // EDIT
        const res = await fetch(`/api/departments/${editTarget.id}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmedName, institute_name: trimmedInstitute }),
        });
        const data = await res.json();
        if (!res.ok) {
          const err = data.error || 'Failed to update department';
          setModalError(err);
          showToast('error', err);
          return;
        }

        setDepartments((prev) => prev.map((d) => (d.id === editTarget.id ? data.department : d)));
        showToast('success', `${trimmedName} updated successfully`);
        setShowModal(false);
      } else {
        // CREATE
        const res = await fetch('/api/departments', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmedName, institute_name: trimmedInstitute }),
        });
        const data = await res.json();
        if (!res.ok) {
          const err = data.error || 'Failed to create department';
          setModalError(err);
          showToast('error', err);
          return;
        }

        setDepartments((prev) => [data, ...prev]);
        showToast('success', `${trimmedName} created successfully`);
        setShowModal(false);
      }
    } catch (err) {
      setModalError('Network error occurred. Please try again.');
      showToast('error', 'Network error');
    } finally {
      setProcessing(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/departments/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data.error || 'Deletion failed due to server constraints';
        setDeleteError(errorMsg);
        showToast('error', errorMsg);
        return;
      }

      setDepartments((prev) => prev.filter((dept) => dept.id !== deleteTarget.id));
      showToast('success', `${deleteTarget.name} deleted successfully`);
      setDeleteTarget(null);
    } catch (e) {
      const errorMsg = 'Network error while attempting deletion';
      setDeleteError(errorMsg);
      showToast('error', errorMsg);
    } finally {
      setDeleting(false);
    }
  };

  // ── TanStack Columns ──
  const columns = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Department Name" />,
        cell: ({ getValue }) => (
          <span className="font-semibold text-[#0f172a] text-xs flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-[#eff1ff] text-[#4f46e5] flex items-center justify-center shrink-0">
              <IconBuilding size={14} />
            </span>
            {getValue()}
          </span>
        ),
      },
      {
        accessorKey: 'institute_name',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Institute Name" />,
        cell: ({ getValue }) => <span className="font-medium text-[#334155]">{getValue()}</span>,
      },
      {
        accessorKey: 'created_at',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Created Date" />,
        cell: ({ getValue }) => (
          <span className="inline-flex items-center gap-1.5 text-[#64748b] text-[11px]">
            <IconCalendar size={13} className="text-[#94a3b8]" />
            {getValue()
              ? new Date(getValue()).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : '—'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => (
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#64748b]">Actions</span>
        ),
        cell: ({ row }) => {
          const d = row.original;
          return (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openEdit(d)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border border-[#c7d2fe] bg-[#eff1ff] text-[#4338ca] hover:bg-[#e0e7ff] transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
                title="Edit Department"
                aria-label={`Edit ${d.name} department`}
              >
                <IconEdit size={13} />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(d);
                  setDeleteError(null);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border border-[#fecaca] bg-white text-[#991b1b] hover:bg-[#fef2f2] transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500"
                title="Delete Department"
                aria-label={`Delete ${d.name} department`}
              >
                <IconTrash size={13} />
                <span>Delete</span>
              </button>
            </div>
          );
        },
      },
    ],
    []
  );

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

