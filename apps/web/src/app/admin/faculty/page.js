'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { fetchCollection } from '@/lib/fetch-collection';
import LoadingOverlay from '@/components/LoadingOverlay';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useSocket } from '@/hooks/useSocket';
import RefreshButton from '@/components/RefreshButton';
import { AdminDataTable, DataTableColumnHeader, StatusBadge } from '@/components/ui/data-table';
import {
  IconSearch,
  IconPlus,
  IconUpload,
  IconEdit,
  IconBan,
  IconCheck,
  IconDownload,
  IconId,
  IconX,
  IconChevronDown,
} from '@tabler/icons-react';

// ─── PDF Generator ────────────────────────────────────────────────────────────
async function downloadCredentialsPDF(users) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.setTextColor(79, 70, 229);
  doc.text('CodeRank — Faculty Credentials', 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleString()}  |  CONFIDENTIAL — delete after distribution`, 14, 28);

  autoTable(doc, {
    startY: 35,
    head: [['Name', 'Email', 'Department', 'Designation', 'Password']],
    body: users.map((u) => [
      u.name,
      u.email,
      u.extra_info?.department || '-',
      u.extra_info?.designation || '-',
      u.rawPassword,
    ]),
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 255] },
  });

  doc.save(`CodeRank_Faculty_${Date.now()}.pdf`);
}

export default function FacultyManagement() {
  const { token: authToken, isReady } = useAdminAuth();
  const socket = useSocket();

  const [faculty, setFaculty] = useState([]);
  const [pageCursor, setPageCursor] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [cursorHistory, setCursorHistory] = useState([null]); // track cursor stack for back navigation
  const [currentPage, setCurrentPage] = useState(1);
  const requestVersion = useRef(0);
  const activeAbortController = useRef(null);

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

        const res = await fetch(url, {
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
        const res = await fetch(`/api/users/${editTarget.id}`, {
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
        const res = await fetch('/api/users', {
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
      const res = await fetch(`/api/users/${f.id}`, {
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
      const res = await fetch(`/api/users/${f.id}`, {
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
      const formData = new FormData();
      formData.append('file', file);
      formData.append('role', 'faculty');

      const res = await fetch('/api/users/bulk', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
        body: formData,
      });

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
      {showModal && (
        <div
          className="fixed inset-0 bg-[#0f172a]/45 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={() => !processing && setShowModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 sm:p-7 w-full max-w-lg shadow-2xl border border-[#e2e8f0] max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="flex items-start justify-between mb-4 pb-3 border-b border-[#f1f5f9]">
              <div>
                <h2 id="modal-title" className="text-lg font-bold text-[#0f172a] leading-snug">
                  {editTarget ? `Edit ${editTarget.name}` : 'Add New Faculty Member'}
                </h2>
                <p className="text-xs text-[#64748b] mt-0.5">
                  {editTarget
                    ? 'Update faculty credentials and institutional details.'
                    : 'Enter faculty details. Credentials will be securely generated.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-[#94a3b8] hover:text-[#0f172a] p-1 rounded-lg hover:bg-[#f1f5f9] transition-colors"
                aria-label="Close modal"
              >
                <IconX size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#334155] mb-1">
                  Faculty ID (Max 5 digits) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={5}
                  placeholder="e.g. 1042"
                  value={form.facultyId}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 5);
                    setForm((f) => ({ ...f, facultyId: val }));
                    if (formErrors.facultyId) setFormErrors((err) => ({ ...err, facultyId: null }));
                  }}
                  className={`w-full text-xs border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 ${
                    formErrors.facultyId ? 'border-red-400 focus:ring-red-200' : 'border-[#dbe1ea] focus:ring-[#c7d2fe]'
                  }`}
                />
                {formErrors.facultyId && <p className="text-[11px] text-red-600 mt-1">{formErrors.facultyId}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh"
                    value={form.firstName}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, firstName: e.target.value.replace(/[^A-Za-z\s]/g, '') }));
                      if (formErrors.firstName) setFormErrors((err) => ({ ...err, firstName: null }));
                    }}
                    className={`w-full text-xs border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 ${
                      formErrors.firstName ? 'border-red-400 focus:ring-red-200' : 'border-[#dbe1ea] focus:ring-[#c7d2fe]'
                    }`}
                  />
                  {formErrors.firstName && <p className="text-[11px] text-red-600 mt-1">{formErrors.firstName}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Patel"
                    value={form.lastName}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, lastName: e.target.value.replace(/[^A-Za-z\s]/g, '') }));
                      if (formErrors.lastName) setFormErrors((err) => ({ ...err, lastName: null }));
                    }}
                    className={`w-full text-xs border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 ${
                      formErrors.lastName ? 'border-red-400 focus:ring-red-200' : 'border-[#dbe1ea] focus:ring-[#c7d2fe]'
                    }`}
                  />
                  {formErrors.lastName && <p className="text-[11px] text-red-600 mt-1">{formErrors.lastName}</p>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#334155] mb-1">
                  Institutional Email <span className="text-red-500">*</span>
                </label>
                <div
                  className={`flex items-center border rounded-lg overflow-hidden bg-white focus-within:ring-2 ${
                    formErrors.emailPrefix ? 'border-red-400 focus-within:ring-red-200' : 'border-[#dbe1ea] focus-within:ring-[#c7d2fe]'
                  }`}
                >
                  <input
                    type="text"
                    placeholder="ramesh.patel"
                    value={form.emailPrefix}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, emailPrefix: e.target.value.replace(/[^a-zA-Z0-9.\-_]/g, '') }));
                      if (formErrors.emailPrefix) setFormErrors((err) => ({ ...err, emailPrefix: null }));
                    }}
                    disabled={!!editTarget}
                    className="flex-1 border-0 px-3 py-2 text-xs focus:outline-none"
                    style={editTarget ? { opacity: 0.6, cursor: 'not-allowed', backgroundColor: '#f8fafc' } : {}}
                  />
                  <span className="px-3 py-2 bg-[#f1f5f9] text-[#64748b] text-xs font-mono border-l border-[#dbe1ea] select-none">
                    @charusat.ac.in
                  </span>
                </div>
                {formErrors.emailPrefix && <p className="text-[11px] text-red-600 mt-1">{formErrors.emailPrefix}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">
                    Department <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.department}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, department: e.target.value }));
                      if (formErrors.department) setFormErrors((err) => ({ ...err, department: null }));
                    }}
                    className={`w-full text-xs border rounded-lg px-3 py-2 bg-white text-[#334155] focus:outline-none focus:ring-2 ${
                      formErrors.department ? 'border-red-400 focus:ring-red-200' : 'border-[#dbe1ea] focus:ring-[#c7d2fe]'
                    }`}
                  >
                    <option value="" disabled>Select Department</option>
                    {departmentsList.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name} ({d.institute_name})
                      </option>
                    ))}
                  </select>
                  {formErrors.department && <p className="text-[11px] text-red-600 mt-1">{formErrors.department}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Designation</label>
                  <input
                    type="text"
                    placeholder="e.g. Assistant Professor"
                    value={form.designation}
                    onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
                    className="w-full text-xs border border-[#dbe1ea] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#c7d2fe]"
                  />
                </div>
              </div>

              {editTarget && (
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">
                    New Password (leave blank to keep unchanged)
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, password: e.target.value }));
                      if (formErrors.password) setFormErrors((err) => ({ ...err, password: null }));
                    }}
                    className={`w-full text-xs border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 ${
                      formErrors.password ? 'border-red-400 focus:ring-red-200' : 'border-[#dbe1ea] focus:ring-[#c7d2fe]'
                    }`}
                  />
                  {formErrors.password && <p className="text-[11px] text-red-600 mt-1">{formErrors.password}</p>}
                </div>
              )}

              {!editTarget && (
                <div className="p-3 bg-[#eff1ff]/60 border border-[#c7d2fe] rounded-lg text-xs text-[#4338ca] flex items-center gap-2">
                  <IconDownload size={16} className="text-[#4f46e5] shrink-0" />
                  <span>A secure random password will be generated and saved to a PDF credential sheet upon creation.</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 text-xs font-semibold rounded-lg bg-[#4f46e5] hover:bg-[#4338ca] text-white shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
                  disabled={processing}
                >
                  {processing ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Faculty'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 px-4 text-xs font-semibold rounded-lg border border-[#dbe1ea] bg-white text-[#475569] hover:bg-[#f1f5f9] cursor-pointer transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

