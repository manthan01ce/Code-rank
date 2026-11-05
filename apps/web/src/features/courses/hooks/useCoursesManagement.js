'use client';
import { createRequestScope } from '@/lib/client/http-client';
import { courseRequest } from '../api/courses-api';

import { useState, useEffect, useMemo } from 'react';
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
  IconBook,
} from '@tabler/icons-react';

export function useCoursesManagement() {
  const [listRequests] = useState(createRequestScope);
  useEffect(() => () => listRequests.cancel(), [listRequests]);
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
    return () => listRequests.cancel();
  }, [search, isReady]);

  const fetchCourses = async () => {
    const request = listRequests.begin();
    setLoading(true);
    try {
      const token = authToken;
      const url = search ? `/api/courses?search=${encodeURIComponent(search)}` : '/api/courses';
      const rows = await fetchCollection(url, {
        headers: { Authorization: `Bearer ${token}` }, signal: request.signal,
      });
      if (!request.isCurrent()) return;
      setCourses(rows);
      setLastUpdated(new Date());
    } catch (e) {
      if (request.isCurrent()) console.error(e);
    } finally {
      if (request.isCurrent()) setLoading(false);
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
        const res = await courseRequest(editId, {
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
        const res = await courseRequest(null, {
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
      const res = await courseRequest(id, {
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


  return { socket, courses, setCourses, loading, setLoading, processing, setProcessing, search, setSearch, semesterFilter, setSemesterFilter, lastUpdated, setLastUpdated, showAddModal, setShowAddModal, editId, setEditId, newCourseCode, setNewCourseCode, newCourseName, setNewCourseName, newCourseSem, setNewCourseSem, authToken, isReady, fetchCourses, handleAddOrEditCourse, deleteCourse, handleEditClick, resetForm, filteredCourses, columns };
}
