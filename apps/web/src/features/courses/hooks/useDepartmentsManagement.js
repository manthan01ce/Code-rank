'use client';
import { createRequestScope } from '@/lib/http-client';
import { departmentRequest } from '../api/courses-api';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchCollection } from '@/lib/fetch-collection';
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

export function useDepartmentsManagement() {
  const [listRequests] = useState(createRequestScope);
  useEffect(() => () => listRequests.cancel(), [listRequests]);
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
      const request = listRequests.begin();
      if (isInitial) {
        setLoading(true);
      } else {
        setFetching(true);
      }
      try {
        let url = '/api/departments';
        if (debouncedSearch) url += `?search=${encodeURIComponent(debouncedSearch)}`;
        const rows = await fetchCollection(url, { signal: request.signal, headers: { Authorization: `Bearer ${token()}` } });
        if (!request.isCurrent()) return;
        setDepartments(Array.isArray(rows) ? rows : []);
        setLastUpdated(new Date());
      } catch (e) {
        if (!request.isCurrent()) return;
        console.error('Failed to fetch departments:', e);
        if (isInitial) setDepartments([]);
        showToast('error', 'Failed to fetch departments');
      } finally {
        if (request.isCurrent()) { setLoading(false); setFetching(false); }
      }
    },
    [authToken, debouncedSearch, token, showToast, listRequests]
  );

  // Initial load
  useEffect(() => {
    if (isReady) fetchDepartments(true);
  }, [isReady]);

  // Re-fetch when debounced search query changes (background update)
  useEffect(() => {
    if (isReady) fetchDepartments(false);
    return () => listRequests.cancel();
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
        const res = await departmentRequest(editTarget.id, {
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
        const res = await departmentRequest(null, {
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
      const res = await departmentRequest(deleteTarget.id, {
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


  return { socket, departments, setDepartments, loading, setLoading, fetching, setFetching, processing, setProcessing, searchInput, setSearchInput, debouncedSearch, setDebouncedSearch, showModal, setShowModal, editTarget, setEditTarget, form, setForm, formErrors, setFormErrors, modalError, setModalError, deleteTarget, setDeleteTarget, deleting, setDeleting, deleteError, setDeleteError, toast, setToast, lastUpdated, setLastUpdated, authToken, isReady, token, showToast, isFormDirty, handleCloseModal, fetchDepartments, openAdd, openEdit, handleSubmit, confirmDelete, columns };
}
