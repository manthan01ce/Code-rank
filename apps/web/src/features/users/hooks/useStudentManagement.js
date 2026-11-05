'use client';
import { userRequest, userListRequest, uploadUsers } from '../api/users-api';
import { useUserListLifecycle } from './useUserListLifecycle';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { fetchCollection } from '@/lib/fetch-collection';

import { useAdminAuth } from '@/features/auth/hooks/useAdminAuth';
import { useSocket } from '@/hooks/useSocket';

import { DataTableColumnHeader, StatusBadge } from '@/components/ui/data-table';
import { IconEdit, IconBan, IconCheck } from '@tabler/icons-react';

import { downloadStudentCredentialsPDF as downloadCredentialsPDF } from '@/features/users/credential-pdf';

export function useStudentManagement() {
  const { token: authToken, isReady } = useAdminAuth();
  const socket = useSocket();

  const [students, setStudents] = useState([]);
  const [pageCursor, setPageCursor] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const { requestVersion, activeAbortController } = useUserListLifecycle();
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

        const res = await userListRequest(url, {
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
        const res = await userRequest(editTarget.id, {
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
        const res = await userRequest(null, {
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
      const res = await userRequest(s.id, {
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
      const res = await userRequest(s.id, {
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
      const res = await uploadUsers(file, 'student', token());

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

  return { authToken, isReady, socket, students, setStudents, pageCursor, setPageCursor, nextCursor, setNextCursor, requestVersion, activeAbortController, departmentsList, setDepartmentsList, loading, setLoading, fetching, setFetching, processing, setProcessing, searchInput, setSearchInput, debouncedSearch, setDebouncedSearch, statusFilter, setStatusFilter, divisionFilter, setDivisionFilter, showModal, setShowModal, editTarget, setEditTarget, toast, setToast, lastUpdated, setLastUpdated, fileRef, form, setForm, token, showToast, validateDivision, fetchStudents, fetchDepartments, openAdd, openEdit, handleSubmit, handleDelete, handleReactivate, handleBulkUpload, columns };
}
