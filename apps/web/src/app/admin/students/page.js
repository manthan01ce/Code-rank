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
  IconSchool,
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
  doc.text('CodeRank — Student Credentials', 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleString()}  |  CONFIDENTIAL — delete after distribution`, 14, 28);

  autoTable(doc, {
    startY: 35,
    head: [['Name', 'Email', 'Roll No', 'Department', 'Division', 'Semester', 'Password']],
    body: users.map((u) => [
      u.name,
      u.email,
      u.extra_info?.roll_number || '-',
      u.extra_info?.department || '-',
      u.extra_info?.division || '-',
      u.extra_info?.semester || '-',
      u.rawPassword,
    ]),
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 255] },
  });

  doc.save(`CodeRank_Students_${Date.now()}.pdf`);
}

export default function StudentManagement() {
  const { token: authToken, isReady } = useAdminAuth();
  const socket = useSocket();

  const [students, setStudents] = useState([]);
  const [pageCursor, setPageCursor] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const requestVersion = useRef(0);
  const activeAbortController = useRef(null);
  const [departmentsList, setDepartmentsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [processing, setProcessing] = useState(false);
  // Decouple typed input from debounced server query
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [divisionFilter, setDivisionFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [toast, setToast] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const fileRef = useRef(null);

  // Form fields
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    roll: '',
    department: '',
    semester: '',
    division: '',
    password: '',
  });

  const token = useCallback(() => {
    return (typeof window !== 'undefined' ? localStorage.getItem('token') : null) || authToken || '';
  }, [authToken]);

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const validateDivision = (div) => {
    if (!div || !div.trim()) return 'Division is compulsory.';
    const alphaMatches = div.match(/[a-zA-Z]/g) || [];
    const digitMatches = div.match(/[0-9]/g) || [];
    if (alphaMatches.length < 2) return 'Division must contain at least 2 alphabetic letters (e.g., CE1, IT2).';
    if (digitMatches.length < 1) return 'Division must contain at least 1 numeric digit (e.g., CE1, IT2).';
    return null;
  };

  // ── Debounce search input (300ms) ──
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // ── Fetch Students ──
  const fetchStudents = useCallback(
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
        let url = `/api/users?role=student&status=${statusFilter}`;
        if (debouncedSearch) url += `&search=${encodeURIComponent(debouncedSearch)}`;
        if (divisionFilter && divisionFilter !== 'all') url += `&division=${encodeURIComponent(divisionFilter)}`;
        if (cursor) url += `&cursor=${cursor}`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${authToken}` },
          signal: controller.signal,
        });

        if (res.ok) {
          const data = await res.json();
          if (version !== requestVersion.current) return;
          setPageCursor(cursor);
          setNextCursor(res.headers.get('X-Next-Cursor') || null);
          setStudents(Array.isArray(data) ? data : []);
          setLastUpdated(new Date());
          if (isPageReset) {
            setPageCursor(null);
            setNextCursor(null);
          }
        } else {
          if (version === requestVersion.current) {
            if (res.status === 401) {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              window.location.href = '/';
              return;
            }
            console.error('Failed to fetch students:', res.status);
            showToast('error', 'Unable to fetch student records');
          }
        }
      } catch (e) {
        if (e.name !== 'AbortError' && version === requestVersion.current) {
          console.error('Fetch students error:', e);
          showToast('error', 'Network error fetching students');
        }
      } finally {
        if (version === requestVersion.current) {
          setFetching(false);
          setLoading(false);
        }
      }
    },
    [authToken, debouncedSearch, statusFilter, divisionFilter, showToast]
  );

  // Real-time WebSocket synchronization for student master
  useEffect(() => {
    if (!socket) return;
    socket.emit('join_admin_room');

    const handleStudentUpdate = () => fetchStudents(null, false);

    socket.on('user_created', handleStudentUpdate);
    socket.on('user_updated', handleStudentUpdate);
    socket.on('user_deleted', handleStudentUpdate);
    socket.on('admin_stats_changed', handleStudentUpdate);

    return () => {
      socket.off('user_created', handleStudentUpdate);
      socket.off('user_updated', handleStudentUpdate);
      socket.off('user_deleted', handleStudentUpdate);
      socket.off('admin_stats_changed', handleStudentUpdate);
    };
  }, [socket, fetchStudents]);

  const fetchDepartments = useCallback(async () => {
    try {
      setDepartmentsList(await fetchCollection('/api/departments', { headers: { Authorization: `Bearer ${token()}` } }));
    } catch (e) {
      console.error(e);
    }
  }, [token]);

  // Initial load
  useEffect(() => {
    if (isReady) {
      setLoading(true);
      fetchStudents(null, true);
    }
  }, [isReady]);

  // Re-fetch when filters or debounced search change (background, no full-page loading)
  useEffect(() => {
    if (isReady) fetchStudents(null, true);
  }, [debouncedSearch, statusFilter, divisionFilter]);

  useEffect(() => {
    if (isReady) fetchDepartments();
  }, [isReady, fetchDepartments]);

  // Keyboard accessibility for modal (Escape closes)
  useEffect(() => {
    if (!showModal) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !processing) setShowModal(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal, processing]);

  // ── Open modal ──
  const openAdd = () => {
    setEditTarget(null);
    setForm({ firstName: '', lastName: '', roll: '', department: '', semester: '1', division: '', password: '' });
    setShowModal(true);
  };

  const openEdit = (s) => {
    setEditTarget(s);
    setForm({
      firstName: s.first_name || s.name?.split(' ')[0] || '',
      lastName: s.last_name || s.name?.split(' ').slice(1).join(' ') || '',
      roll: s.extra_info?.roll_number || '',
      department: s.extra_info?.department || '',
      semester: String(s.extra_info?.semester || '1'),
      division: s.extra_info?.division || '',
      password: '',
    });
    setShowModal(true);
  };

  // ── Submit ──
  const handleSubmit = async (e) => {
    e.preventDefault();

    const divError = validateDivision(form.division);
    if (divError) {
      showToast('error', divError);
      return;
    }

    setProcessing(true);
    try {
      const email = `${form.roll.trim().toLowerCase()}@charusat.edu.in`;
      if (editTarget) {
        // EDIT
        const res = await fetch(`/api/users/${editTarget.id}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            first_name: form.firstName,
            last_name: form.lastName,
            email: email,
            role: 'student',
            status: editTarget.status,
            extra_info: {
              roll_number: form.roll.trim().toUpperCase(),
              department: form.department,
              semester: parseInt(form.semester),
              division: form.division.trim().toUpperCase(),
            },
            password: form.password || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast('error', data.error || 'Update failed');
          return;
        }

        setStudents((prev) => prev.map((s) => (s.id === editTarget.id ? data.user : s)));
        showToast('success', `${form.firstName} updated successfully`);
        setShowModal(false);
      } else {
        // CREATE
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            first_name: form.firstName,
            last_name: form.lastName,
            email: email,
            role: 'student',
            extra_info: {
              roll_number: form.roll.trim().toUpperCase(),
              department: form.department,
              semester: parseInt(form.semester),
              division: form.division.trim().toUpperCase(),
            },
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast('error', data.error || 'Create failed');
          return;
        }

        const newStudent = {
          ...data.user,
          status: 'active',
        };
        setStudents((prev) => [newStudent, ...prev]);
        await downloadCredentialsPDF([{ ...newStudent, rawPassword: data.rawPassword }]);
        showToast('success', `${form.firstName} created! Password PDF downloaded.`);
        setShowModal(false);
      }
    } catch (err) {
      showToast('error', 'Network error — please try again');
    } finally {
      setProcessing(false);
      setForm({ firstName: '', lastName: '', roll: '', department: '', semester: '1', division: '', password: '' });
    }
  };

  // ── Deactivate ──
  const handleDelete = async (s) => {
    if (!confirm(`Deactivate ${s.name}? This will mark the account as inactive.`)) return;
    setProcessing(true);
    try {
      const activeToken = token();
      if (!activeToken) {
        showToast('error', 'Authentication expired. Please log in again.');
        return;
      }
      const res = await fetch(`/api/users/${s.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'Deactivation failed');
        return;
      }

      setStudents((prev) =>
        prev.map((student) => (student.id === s.id ? { ...student, status: 'inactive' } : student))
      );
      showToast('success', `${s.name} marked as inactive`);
    } catch (e) {
      showToast('error', 'Network error');
    } finally {
      setProcessing(false);
    }
  };

  // ── Reactivate ──
  const handleReactivate = async (s) => {
    if (!confirm(`Reactivate ${s.name}? This will restore the account.`)) return;
    setProcessing(true);
    try {
      const activeToken = token();
      if (!activeToken) {
        showToast('error', 'Authentication expired. Please log in again.');
        return;
      }
      const res = await fetch(`/api/users/${s.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${activeToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'Reactivation failed');
        return;
      }

      setStudents((prev) =>
        prev.map((student) => (student.id === s.id ? data.user : student))
      );
      showToast('success', `${s.name} reactivated successfully`);
    } catch (e) {
      showToast('error', 'Network error');
    } finally {
      setProcessing(false);
    }
  };

  // ── Bulk Upload ──
  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = null;
    setProcessing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('role', 'student');

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
        const newStudents = created.map((u) => ({ ...u, status: 'active' }));
        setStudents((prev) => [...newStudents, ...prev]);
        await downloadCredentialsPDF(created);
      }

      if (updated.length > 0) {
        setStudents((prev) =>
          prev.map((s) => {
            const match = updated.find((u) => u.id === s.id);
            return match ? { ...match, status: 'active' } : s;
          })
        );
      }

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
        id: 'roll',
        accessorFn: (row) => row.extra_info?.roll_number || '—',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Roll No" />,
        cell: ({ getValue }) => (
          <span className="font-semibold text-[#4f46e5] text-xs font-mono">
            {getValue()}
          </span>
        ),
      },
      {
        accessorKey: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
        cell: ({ row }) => (
          <div>
            <div className="font-semibold text-[#0f172a]">{row.original.name}</div>
          </div>
        ),
      },
      {
        accessorKey: 'email',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
        cell: ({ getValue }) => <span className="text-[#64748b] font-mono text-[11px]">{getValue()}</span>,
      },
      {
        id: 'department',
        accessorFn: (row) => row.extra_info?.department || '—',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Branch" />,
        cell: ({ getValue }) => <span className="text-[#334155]">{getValue()}</span>,
      },
      {
        id: 'division',
        accessorFn: (row) => row.extra_info?.division || '—',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Division" />,
        cell: ({ getValue }) => (
          <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-[#eff1ff] text-[#4338ca] border border-[#c7d2fe]">
            {getValue()}
          </span>
        ),
      },
      {
        id: 'semester',
        accessorFn: (row) => row.extra_info?.semester || '—',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Sem" />,
        cell: ({ getValue }) => <span className="text-[#475569] font-medium">Sem {getValue()}</span>,
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
          const s = row.original;
          return (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openEdit(s)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border border-[#c7d2fe] bg-[#eff1ff] text-[#4338ca] hover:bg-[#e0e7ff] transition-colors cursor-pointer"
                title="Edit Student Details"
              >
                <IconEdit size={13} />
                <span>Edit</span>
              </button>

              {s.status === 'active' ? (
                <button
                  type="button"
                  onClick={() => handleDelete(s)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border border-[#fecaca] bg-white text-[#991b1b] hover:bg-[#fef2f2] transition-colors cursor-pointer"
                  title="Deactivate Student"
                >
                  <IconBan size={13} />
                  <span>Deactivate</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleReactivate(s)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border border-[#bbf7d0] bg-white text-[#15803d] hover:bg-[#f0fdf4] transition-colors cursor-pointer"
                  title="Reactivate Student"
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
            aria-labelledby="student-modal-title"
          >
            <div className="flex items-start justify-between mb-4 pb-3 border-b border-[#f1f5f9]">
              <div>
                <h2 id="student-modal-title" className="text-lg font-bold text-[#0f172a] leading-snug">
                  {editTarget ? `Edit ${editTarget.name}` : 'Add New Student'}
                </h2>
                <p className="text-xs text-[#64748b] mt-0.5">
                  {editTarget ? 'Update student enrollment and division information.' : 'Create student account. Password is auto-generated.'}
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">First Name *</label>
                  <input
                    aria-label="First Name"
                    placeholder="First Name *"
                    value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value.replace(/[^A-Za-z\s]/g, '') }))}
                    required
                    className="w-full text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Last Name *</label>
                  <input
                    aria-label="Last Name"
                    placeholder="Last Name *"
                    value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value.replace(/[^A-Za-z\s]/g, '') }))}
                    required
                    className="w-full text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Roll / ID Number *</label>
                  <input
                    aria-label="Roll Number"
                    placeholder="Roll Number (e.g. 25ce097 or D25ce097) *"
                    value={form.roll}
                    onChange={(e) => setForm((f) => ({ ...f, roll: e.target.value.toUpperCase() }))}
                    required
                    disabled={!!editTarget}
                    className="w-full text-xs font-mono"
                    style={editTarget ? { opacity: 0.6, cursor: 'not-allowed', backgroundColor: '#f8fafc' } : {}}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Semester *</label>
                  <select
                    value={form.semester}
                    onChange={(e) => setForm((f) => ({ ...f, semester: e.target.value }))}
                    required
                    className="w-full text-xs"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s}>Semester {s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Department / Branch *</label>
                  <select
                    value={form.department}
                    onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                    required
                    className="w-full text-xs"
                  >
                    <option value="" disabled>Select Department</option>
                    {departmentsList.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name} ({d.institute_name})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Division (e.g. CE1) *</label>
                  <input
                    aria-label="Division"
                    placeholder="Division (e.g. CE1, IT2) *"
                    value={form.division}
                    onChange={(e) => setForm((f) => ({ ...f, division: e.target.value.toUpperCase() }))}
                    required
                    className="w-full text-xs font-mono"
                  />
                </div>
              </div>
              <p className="text-[11px] text-[#64748b]">
                Division must contain at least 2 letters and 1 digit (e.g. <strong>CE1</strong>, <strong>IT2</strong>, <strong>CSE1</strong>).
              </p>

              <div>
                <label className="block text-xs font-semibold text-[#334155] mb-1">Institutional Email</label>
                <div className="flex items-center border border-[#dbe1ea] rounded-lg overflow-hidden bg-white">
                  <input
                    aria-label="Email"
                    value={form.roll ? form.roll.toLowerCase() : ''}
                    disabled
                    className="flex-1 border-0 rounded-none text-xs font-mono bg-[#f8fafc] text-[#64748b]"
                  />
                  <span className="px-3 py-2 bg-[#f1f5f9] text-[#64748b] text-xs font-mono border-l border-[#dbe1ea]">
                    @charusat.edu.in
                  </span>
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
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    className="w-full text-xs"
                  />
                </div>
              )}

              {!editTarget && (
                <div className="p-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg text-xs text-[#64748b] flex items-center gap-2">
                  <IconDownload size={16} className="text-[#4f46e5] shrink-0" />
                  <span>A secure password will be generated and downloaded as a PDF immediately.</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="submit"
                  className="btn-primary flex-1 py-2.5 text-xs font-semibold rounded-lg bg-[#4f46e5] hover:bg-[#4338ca] text-white shadow-xs cursor-pointer disabled:opacity-50"
                  disabled={processing}
                >
                  {processing ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Student'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 text-xs font-semibold rounded-lg border border-[#dbe1ea] bg-white text-[#475569] hover:bg-[#f1f5f9] cursor-pointer"
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
