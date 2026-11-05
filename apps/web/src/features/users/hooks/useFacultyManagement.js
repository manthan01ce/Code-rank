'use client';
import { userRequest, userListRequest, uploadUsers } from '../api/users-api';
import { useUserListLifecycle } from './useUserListLifecycle';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { fetchCollection } from '@/lib/fetch-collection';

import { useAdminAuth } from '@/features/auth/hooks/useAdminAuth';
import { useSocket } from '@/hooks/useSocket';

import { DataTableColumnHeader, StatusBadge } from '@/components/ui/data-table';
import { IconEdit, IconBan, IconCheck, IconId } from '@tabler/icons-react';

import { downloadFacultyCredentialsPDF as downloadCredentialsPDF } from '@/features/users/credential-pdf';

export function useFacultyManagement() {
  const { token: authToken, isReady } = useAdminAuth();
  const socket = useSocket();

  const [faculty, setFaculty] = useState([]);
  const [pageCursor, setPageCursor] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [cursorHistory, setCursorHistory] = useState([null]); // track cursor stack for back navigation
  const [currentPage, setCurrentPage] = useState(1);
  const { requestVersion, activeAbortController } = useUserListLifecycle();

  const [departmentsList, setDepartmentsList] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Search input state (immediate UI typing) vs applied search (debounced server query)
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    facultyId: '',
    firstName: '',
    lastName: '',
    emailPrefix: '',
    department: '',
    designation: '',
    password: '',
  });

  const token = useCallback(() => {
    return (typeof window !== 'undefined' ? localStorage.getItem('token') : null) || authToken || '';
  }, [authToken]);

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 5000);
  }, []);

  // ── Debounce search input (300ms) ──
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // ── Fetch Faculty Data ──
  const fetchFaculty = useCallback(
    async (cursor = null, isPageReset = false) => {
      if (!authToken) return;

      if (activeAbortController.current) {
        activeAbortController.current.abort();
      }
      const controller = new AbortController();
      activeAbortController.current = controller;

      const version = ++requestVersion.current;
      setFetching(true);

      try {
        let url = `/api/users?role=faculty&status=${statusFilter}`;
        if (debouncedSearch) url += `&search=${encodeURIComponent(debouncedSearch)}`;
        if (cursor) url += `&cursor=${cursor}`;

        const res = await userListRequest(url, {
          headers: { Authorization: `Bearer ${authToken}` },
          signal: controller.signal,
        });

        if (res.ok) {
          const data = await res.json();
          if (version !== requestVersion.current) return;

          setFaculty(Array.isArray(data) ? data : []);
          setPageCursor(cursor);
          setNextCursor(res.headers.get('X-Next-Cursor') || null);
          setLastUpdated(new Date());

          if (isPageReset) {
            setCursorHistory([null]);
            setCurrentPage(1);
          }
        } else {
          if (version === requestVersion.current) {
            console.error('Failed to fetch faculty:', res.status);
            showToast('error', 'Unable to fetch faculty records');
          }
        }
      } catch (e) {
        if (e.name !== 'AbortError' && version === requestVersion.current) {
          console.error('Fetch faculty error:', e);
          showToast('error', 'Network error fetching faculty');
        }
      } finally {
        if (version === requestVersion.current) {
          setFetching(false);
          setInitialLoading(false);
        }
      }
    },
    [authToken, debouncedSearch, statusFilter, showToast]
  );

  // Pagination navigation helpers
  const handleNextPage = useCallback(
    (cursor) => {
      if (!cursor) return;
      setCursorHistory((prev) => [...prev, cursor]);
      setCurrentPage((prev) => prev + 1);
      fetchFaculty(cursor, false);
    },
    [fetchFaculty]
  );

  const handleFirstPage = useCallback(() => {
    setCursorHistory([null]);
    setCurrentPage(1);
    fetchFaculty(null, false);
  }, [fetchFaculty]);

  // Real-time WebSocket synchronization for faculty master
  useEffect(() => {
    if (!socket) return;
    socket.emit('join_admin_room');

    const handleFacultyUpdate = () => {
      fetchFaculty(pageCursor, false);
    };

    socket.on('user_created', handleFacultyUpdate);
    socket.on('user_updated', handleFacultyUpdate);
    socket.on('user_deleted', handleFacultyUpdate);
    socket.on('admin_stats_changed', handleFacultyUpdate);

    return () => {
      socket.off('user_created', handleFacultyUpdate);
      socket.off('user_updated', handleFacultyUpdate);
      socket.off('user_deleted', handleFacultyUpdate);
      socket.off('admin_stats_changed', handleFacultyUpdate);
    };
  }, [socket, fetchFaculty, pageCursor]);

  const fetchDepartments = useCallback(async () => {
    try {
      setDepartmentsList(
        await fetchCollection('/api/departments', { headers: { Authorization: `Bearer ${token()}` } })
      );
    } catch (e) {
      console.error(e);
    }
  }, [token]);

  // Fetch when search or filter changes (resets pagination to first page)
  useEffect(() => {
    if (isReady) {
      fetchFaculty(null, true);
    }
  }, [debouncedSearch, statusFilter, isReady, fetchFaculty]);

  useEffect(() => {
    if (isReady) fetchDepartments();
  }, [isReady, fetchDepartments]);

  // ── Modal Actions ──
  const openAdd = () => {
    setEditTarget(null);
    setFormErrors({});
    setForm({
      facultyId: '',
      firstName: '',
      lastName: '',
      emailPrefix: '',
      department: '',
      designation: '',
      password: '',
    });
    setShowModal(true);
  };

  const openEdit = (f) => {
    setEditTarget(f);
    setFormErrors({});
    setForm({
      facultyId: f.extra_info?.facultyId || '',
      firstName: f.first_name || f.name?.split(' ')[0] || '',
      lastName: f.last_name || f.name?.split(' ').slice(1).join(' ') || '',
      emailPrefix: f.email ? f.email.split('@')[0] : '',
      department: f.extra_info?.department || '',
      designation: f.extra_info?.designation || '',
      password: '',
    });
    setShowModal(true);
  };

  // Keyboard accessibility for modal (Escape closes)
  useEffect(() => {
    if (!showModal) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !processing) {
        setShowModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal, processing]);

  // ── Form Validation ──
  const validateForm = () => {
    const errors = {};
    if (!form.facultyId || !form.facultyId.trim()) {
      errors.facultyId = 'Faculty ID is required';
    } else if (!/^\d{1,5}$/.test(form.facultyId.trim())) {
      errors.facultyId = 'Faculty ID must be 1 to 5 digits';
    }

    if (!form.firstName || !form.firstName.trim()) {
      errors.firstName = 'First name is required';
    }

    if (!form.lastName || !form.lastName.trim()) {
      errors.lastName = 'Last name is required';
    }

    if (!editTarget) {
      if (!form.emailPrefix || !form.emailPrefix.trim()) {
        errors.emailPrefix = 'Email prefix is required';
      } else if (!/^[a-zA-Z0-9.\-_]+$/.test(form.emailPrefix.trim())) {
        errors.emailPrefix = 'Invalid characters in email prefix';
      }
    }

    if (!form.department || !form.department.trim()) {
      errors.department = 'Department selection is required';
    }

    if (editTarget && form.password && form.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Submit ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setProcessing(true);
    try {
      const email = `${form.emailPrefix.trim()}@charusat.ac.in`;
      if (editTarget) {
        // EDIT
        const res = await userRequest(editTarget.id, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            first_name: form.firstName.trim(),
            last_name: form.lastName.trim(),
            email: email,
            role: 'faculty',
            status: editTarget.status,
            extra_info: {
              facultyId: form.facultyId.trim(),
              department: form.department,
              designation: form.designation.trim() || undefined,
            },
            password: form.password || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast('error', data.error || 'Update failed');
          return;
        }

        setFaculty((prev) => prev.map((f) => (f.id === editTarget.id ? data.user : f)));
        showToast('success', `${form.firstName} updated successfully`);
        setShowModal(false);
      } else {
        // CREATE
        const res = await userRequest(null, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            first_name: form.firstName.trim(),
            last_name: form.lastName.trim(),
            email: email,
            role: 'faculty',
            extra_info: {
              facultyId: form.facultyId.trim(),
              department: form.department,
              designation: form.designation.trim() || undefined,
            },
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast('error', data.error || 'Create failed');
          return;
        }

        const newFaculty = {
          ...data.user,
          status: 'active',
        };
        setFaculty((prev) => [newFaculty, ...prev]);
        await downloadCredentialsPDF([{ ...newFaculty, rawPassword: data.rawPassword }]);
        showToast('success', `${form.firstName} created! Credentials PDF downloaded.`);
        setShowModal(false);
      }
    } catch (err) {
      showToast('error', 'Network error — please try again');
    } finally {
      setProcessing(false);
    }
  };

  // ── Deactivate ──
  const handleDelete = async (f) => {
    if (!confirm(`Deactivate ${f.name}? This will mark the account as inactive.`)) return;
    setProcessing(true);
    try {
      const activeToken = token();
      if (!activeToken) {
        showToast('error', 'Authentication expired. Please log in again.');
        return;
      }
      const res = await userRequest(f.id, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'Deactivation failed');
        return;
      }

      setFaculty((prev) =>
        prev.map((facultyMember) =>
          facultyMember.id === f.id ? { ...facultyMember, status: 'inactive' } : facultyMember
        )
      );
      showToast('success', `${f.name} marked as inactive`);
    } catch (e) {
      showToast('error', 'Network error');
    } finally {
      setProcessing(false);
    }
  };

  // ── Reactivate ──
  const handleReactivate = async (f) => {
    if (!confirm(`Reactivate ${f.name}? This will restore the account.`)) return;
    setProcessing(true);
    try {
      const activeToken = token();
      if (!activeToken) {
        showToast('error', 'Authentication expired. Please log in again.');
        return;
      }
      const res = await userRequest(f.id, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${activeToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'Reactivation failed');
        return;
      }

      setFaculty((prev) =>
        prev.map((facultyMember) => (facultyMember.id === f.id ? data.user : facultyMember))
      );
      showToast('success', `${f.name} reactivated successfully`);
    } catch (e) {
      showToast('error', 'Network error');
    } finally {
      setProcessing(false);
    }
  };

  // ── Bulk Upload ──
  const handleBulkUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setProcessing(true);
    try {
      const res = await uploadUsers(file, 'faculty', token());

      const data = await res.json();

      if (!res.ok) {
        showToast('error', `Bulk upload failed: ${data.error || 'Unknown error'}`);
        return;
      }

      const { created = [], updated = [], errors = [], summary = {}, skipped = [], skippedCount = 0 } = data;

      if (created.length > 0) {
        await downloadCredentialsPDF(created);
      }

      // Smooth background refetch to reflect exact database state
      await fetchFaculty(pageCursor, false);

      const parts = [];
      if (created.length > 0) parts.push(`${created.length} created`);
      if (updated.length > 0) parts.push(`${updated.length} updated`);
      if (skippedCount > 0) parts.push(`${skippedCount} skipped`);
      if (errors.length > 0) parts.push(`${errors.length} failed`);

      const msg = `${summary.total || 0} rows processed: ${parts.join(', ')}.${created.length > 0 ? ' PDF downloaded!' : ''}`;

      if (skipped.length > 0) {
        const skippedDetails = skipped.map((s, i) => `${i + 1}. ${s.name} (${s.email})\n   → ${s.reason}`).join('\n\n');
        alert(`${skippedCount} user(s) were skipped:\n\n${skippedDetails}`);
      }

      if (errors.length > 0 && created.length === 0 && updated.length === 0) {
        showToast('error', `Upload failed for all rows. Check your file format.`);
      } else {
        showToast('success', msg);
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Error processing bulk upload — ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // ── TanStack Columns ──
  const columns = useMemo(
    () => [
      {
        id: 'facultyId',
        accessorFn: (row) => row.extra_info?.facultyId || '—',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Faculty ID" />,
        cell: ({ getValue }) => (
          <span className="font-semibold text-[#4f46e5] text-xs flex items-center gap-1.5 whitespace-nowrap">
            <IconId size={14} className="text-[#818cf8]" />
            {getValue()}
          </span>
        ),
      },
      {
        accessorKey: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
        cell: ({ row }) => (
          <div className="font-semibold text-[#0f172a] text-xs sm:text-[13px]">
            {row.original.name}
          </div>
        ),
      },
      {
        accessorKey: 'email',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
        cell: ({ getValue }) => (
          <span className="text-[#64748b] font-mono text-[11px] select-all">
            {getValue()}
          </span>
        ),
      },
      {
        id: 'department',
        accessorFn: (row) => row.extra_info?.department || '—',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Department" />,
        cell: ({ getValue }) => <span className="text-[#334155] text-xs font-medium">{getValue()}</span>,
      },
      {
        id: 'designation',
        accessorFn: (row) => row.extra_info?.designation || '',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Designation" />,
        cell: ({ getValue }) => {
          const val = getValue();
          if (!val || val === '—' || val === '-') {
            return <span className="text-[#94a3b8]">—</span>;
          }
          return <span className="text-[#475569] text-xs font-medium">{val}</span>;
        },
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ getValue }) => <StatusBadge status={getValue()} />,
      },
      {
        id: 'actions',
        header: () => <span className="text-[10px] uppercase font-bold tracking-wider text-[#64748b]">Actions</span>,
        cell: ({ row }) => {
          const f = row.original;
          return (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openEdit(f)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border border-[#c7d2fe] bg-[#eff1ff] text-[#4338ca] hover:bg-[#e0e7ff] transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
                title="Edit Faculty Details"
              >
                <IconEdit size={13} />
                <span>Edit</span>
              </button>

              {f.status === 'active' ? (
                <button
                  type="button"
                  onClick={() => handleDelete(f)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border border-[#fecaca] bg-white text-[#991b1b] hover:bg-[#fef2f2] transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500"
                  title="Deactivate Faculty"
                >
                  <IconBan size={13} />
                  <span>Deactivate</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleReactivate(f)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border border-[#bbf7d0] bg-white text-[#15803d] hover:bg-[#f0fdf4] transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  title="Reactivate Faculty"
                >
                  <IconCheck size={13} />
                  <span>Reactivate</span>
                </button>
              )}
            </div>
          );
        },
      },
    ],
    []
  );

  return { authToken, isReady, socket, faculty, setFaculty, pageCursor, setPageCursor, nextCursor, setNextCursor, cursorHistory, setCursorHistory, currentPage, setCurrentPage, requestVersion, activeAbortController, departmentsList, setDepartmentsList, initialLoading, setInitialLoading, fetching, setFetching, processing, setProcessing, searchInput, setSearchInput, debouncedSearch, setDebouncedSearch, statusFilter, setStatusFilter, showModal, setShowModal, editTarget, setEditTarget, formErrors, setFormErrors, toast, setToast, lastUpdated, setLastUpdated, fileRef, form, setForm, token, showToast, fetchFaculty, handleNextPage, handleFirstPage, fetchDepartments, openAdd, openEdit, validateForm, handleSubmit, handleDelete, handleReactivate, handleBulkUpload, columns };
}
