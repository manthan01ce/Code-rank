'use client';

import { useState, useEffect, useMemo } from 'react';
import { fetchCollection } from '@/lib/fetch-collection';
import LoadingOverlay from '@/components/LoadingOverlay';
import { useAdminAuth } from '@/features/auth/hooks/useAdminAuth';
import { useSocket } from '@/hooks/useSocket';
import RefreshButton from '@/components/RefreshButton';
import { AdminDataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import {
  IconSearch,
  IconPlus,
  IconEdit,
  IconTrash,
  IconBook,
} from '@tabler/icons-react';

export default function CoursesManagement() {
  const socket = useSocket();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [search, setSearch] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [lastUpdated, setLastUpdated] = useState(null);

  // Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseSem, setNewCourseSem] = useState('1');

  const { token: authToken, isReady } = useAdminAuth();

  useEffect(() => {
    if (isReady) fetchCourses();
  }, [search, isReady]);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const token = authToken;
      const url = search ? `/api/courses?search=${encodeURIComponent(search)}` : '/api/courses';
      const rows = await fetchCollection(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCourses(rows);
      setLastUpdated(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Real-time WebSocket synchronization for course management
  useEffect(() => {
    if (!socket) return;
    socket.emit('join_admin_room');

    const handleCourseEvent = () => {
      fetchCourses();
    };

    socket.on('course_added', handleCourseEvent);
    socket.on('course_updated', handleCourseEvent);
    socket.on('course_deleted', handleCourseEvent);
    socket.on('admin_stats_changed', handleCourseEvent);

    return () => {
      socket.off('course_added', handleCourseEvent);
      socket.off('course_updated', handleCourseEvent);
      socket.off('course_deleted', handleCourseEvent);
      socket.off('admin_stats_changed', handleCourseEvent);
    };
  }, [socket]);

  const handleAddOrEditCourse = async (e) => {
    e.preventDefault();
    setProcessing(true);
    try {
      const token = authToken || localStorage.getItem('token');
      const payload = {
        course_code: newCourseCode.trim().toUpperCase(),
        name: newCourseName.trim(),
        semester: parseInt(newCourseSem, 10),
      };

      if (editId) {
        const res = await fetch(`/api/courses/${editId}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          setCourses((prev) => prev.map((c) => (c.id === editId ? { ...c, ...payload } : c)));
          resetForm();
        }
      } else {
        const res = await fetch('/api/courses', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const newCourse = await res.json();
          setCourses((prev) => [newCourse, ...prev]);
          resetForm();
        }
      }
    } catch (err) {
      alert('Error saving course');
    } finally {
      setProcessing(false);
    }
  };

  const deleteCourse = async (id) => {
    if (!confirm('Are you sure you want to delete this course permanently?')) return;
    setProcessing(true);
    try {
      const token = authToken || localStorage.getItem('token');
      const res = await fetch(`/api/courses/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setCourses((prev) => prev.filter((c) => c.id !== id));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProcessing(false);
    }
  };

  const handleEditClick = (c) => {
    setEditId(c.id);
    setNewCourseCode(c.course_code || '');
    setNewCourseName(c.name || '');
    setNewCourseSem(String(c.semester || '1'));
    setShowAddModal(true);
  };

  const resetForm = () => {
    setEditId(null);
    setNewCourseCode('');
    setNewCourseName('');
    setNewCourseSem('1');
    setShowAddModal(false);
  };

  // Filter courses locally
  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      const matchSem = semesterFilter === 'all' || String(c.semester) === semesterFilter;
      return matchSem;
    });
  }, [courses, semesterFilter]);

  // ── TanStack Columns ──
  const columns = useMemo(
    () => [
      {
        accessorKey: 'course_code',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Course Code" />,
        cell: ({ getValue }) => (
          <span className="font-mono font-bold text-[#4f46e5] text-xs flex items-center gap-1.5">
            <span className="w-6 h-6 rounded-md bg-[#eff1ff] text-[#4f46e5] flex items-center justify-center shrink-0">
              <IconBook size={14} />
            </span>
            {getValue()}
          </span>
        ),
      },
      {
        accessorKey: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Course Name" />,
        cell: ({ getValue }) => <span className="font-semibold text-[#0f172a] text-xs">{getValue()}</span>,
      },
      {
        accessorKey: 'semester',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Semester" />,
        cell: ({ getValue }) => (
          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-[#f8fafc] text-[#475569] border border-[#e2e8f0]">
            Semester {getValue()}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="text-[10px] uppercase font-bold tracking-wider text-[#64748b]">Actions</span>,
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleEditClick(c)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border border-[#c7d2fe] bg-[#eff1ff] text-[#4338ca] hover:bg-[#e0e7ff] transition-colors cursor-pointer"
                title="Edit Course"
              >
                <IconEdit size={13} />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={() => deleteCourse(c.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border border-[#fecaca] bg-white text-[#991b1b] hover:bg-[#fef2f2] transition-colors cursor-pointer"
                title="Delete Course"
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

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#e2e8f0]">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#0f172a] leading-tight">
            Courses Catalog
          </h1>
          <p className="text-xs sm:text-[13px] text-[#64748b] mt-1 leading-relaxed">
            Maintain the syllabus course catalog, codes, and semester assignments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#4f46e5] hover:bg-[#4338ca] text-white shadow-xs transition-colors cursor-pointer"
            onClick={() => {
              if (showAddModal) resetForm();
              else setShowAddModal(true);
            }}
          >
            <IconPlus size={15} />
            <span>Add New Course</span>
          </button>

          <RefreshButton onRefresh={fetchCourses} lastUpdated={lastUpdated} label="Refresh" variant="default" />
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 bg-white border border-[#e2e8f0] rounded-[13px] shadow-xs">
        <div className="flex flex-1 items-center gap-2 max-w-md bg-[#f8fafc] border border-[#dbe1ea] rounded-lg px-3 py-1.5 focus-within:border-[#4f46e5] focus-within:ring-2 focus-within:ring-[#c7d2fe]">
          <IconSearch size={16} className="text-[#94a3b8] shrink-0" />
          <input
            type="text"
            className="w-full bg-transparent border-0 p-0 text-xs text-[#0f172a] placeholder-[#94a3b8] focus:outline-none"
            aria-label="Search courses"
            placeholder="Search courses by code or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value)}
            className="text-xs border border-[#dbe1ea] rounded-lg bg-white px-3 py-2 text-[#475569] font-medium focus:outline-none focus:border-[#4f46e5]"
            aria-label="Filter by semester"
          >
            <option value="all">All Semesters</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <option key={s} value={String(s)}>Semester {s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Reusable Data Table */}
      <AdminDataTable
        columns={columns}
        data={filteredCourses}
        loading={loading}
        pageSize={10}
        emptyTitle="No courses found"
        emptyDescription={search ? "No courses match your search criteria." : "No courses added to the catalog yet."}
      />

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-[#0f172a]/45 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-8 w-full max-w-md shadow-2xl border border-[#e2e8f0] animate-in fade-in zoom-in-95 duration-150">
            <h2 className="text-xl font-bold text-[#0f172a] mb-1">
              {editId ? 'Edit Course' : 'Add New Course'}
            </h2>
            <p className="text-xs text-[#64748b] mb-5">
              {editId ? 'Modify course details and semester level.' : 'Add a new academic course to the syllabus.'}
            </p>

            <form onSubmit={handleAddOrEditCourse} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#334155] mb-1">
                  Course Code (e.g. CE101 or IT204) *
                </label>
                <input
                  type="text"
                  placeholder="e.g. CE101"
                  value={newCourseCode}
                  onChange={(e) => setNewCourseCode(e.target.value.toUpperCase())}
                  required
                  className="w-full text-xs font-mono font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#334155] mb-1">
                  Course Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Data Structures and Algorithms"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  required
                  className="w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#334155] mb-1">
                  Semester *
                </label>
                <select
                  value={newCourseSem}
                  onChange={(e) => setNewCourseSem(e.target.value)}
                  required
                  className="w-full text-xs"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={String(s)}>Semester {s}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="submit"
                  className="btn-primary flex-1 py-2.5 text-xs font-semibold rounded-lg bg-[#4f46e5] hover:bg-[#4338ca] text-white shadow-xs cursor-pointer disabled:opacity-50"
                  disabled={processing}
                >
                  {processing ? 'Saving…' : editId ? 'Save Changes' : 'Create Course'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
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
