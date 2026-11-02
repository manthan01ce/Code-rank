'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { fetchCollection } from '@/lib/fetch-collection';
import { fetchUserOptions } from '@/lib/fetch-user-options';
import LoadingOverlay from '@/components/LoadingOverlay';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { usePolling } from '@/hooks/usePolling';
import RefreshButton from '@/components/admin/RefreshButton';
import {
  IconSearch,
  IconArrowsShuffle,
  IconCheck,
  IconCrown,
  IconUserPlus,
  IconX,
  IconBook,
  IconDeviceFloppy,
} from '@tabler/icons-react';

export default function CourseMapping() {
  const [courses, setCourses] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [mappings, setMappings] = useState({});
  const [savedMappings, setSavedMappings] = useState({});
  const [savingCourseId, setSavingCourseId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [search, setSearch] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [toast, setToast] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const isDirtyRef = useRef(false);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const { token: authToken, isReady } = useAdminAuth();

  useEffect(() => {
    if (isReady) fetchData(true);
  }, [isReady]);

  const fetchData = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${authToken}` };

      const [cRes, fRes, mRes] = await Promise.all([
        fetchCollection('/api/courses', { headers }),
        fetchUserOptions('/api/users?role=faculty&status=active', { headers }),
        fetch('/api/mapping', { headers }),
      ]);

      setCourses(cRes);
      setFaculties(fRes);
      if (mRes.ok) {
        const mappingData = await mRes.json();
        const initialMap = {};
        for (const [cid, facs] of Object.entries(mappingData)) {
          const co = facs.find((f) => f.is_co_coordinator);
          initialMap[cid] = {
            faculty_ids: facs.map((f) => f.id),
            co_coordinator_id: co ? co.id : facs[0]?.id || null,
          };
        }
        setSavedMappings(JSON.parse(JSON.stringify(initialMap)));
        if (!isDirtyRef.current) {
          setMappings(initialMap);
        }
      }
      setLastUpdated(new Date());
    } catch (e) {
      console.error(e);
      if (isInitial) showToast('error', 'Error loading course mappings');
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  // Auto-refresh silently every 30s when clean
  usePolling(() => {
    if (!processing && !isDirtyRef.current) fetchData(false);
  }, 30_000, isReady);

  const handleSelectFaculty = (courseId, facultyId) => {
    if (!facultyId) return;
    isDirtyRef.current = true;

    setMappings((prev) => {
      const current = prev[courseId] || { faculty_ids: [], co_coordinator_id: null };
      if (current.faculty_ids.includes(facultyId)) return prev;

      if (current.faculty_ids.length >= 4) {
        showToast('error', 'You can assign a maximum of 4 faculties per course.');
        return prev;
      }

      const newFids = [...current.faculty_ids, facultyId];
      return {
        ...prev,
        [courseId]: {
          faculty_ids: newFids,
          co_coordinator_id: current.co_coordinator_id || facultyId,
        },
      };
    });
  };

  const handleRemoveFaculty = (courseId, facultyId) => {
    isDirtyRef.current = true;
    setMappings((prev) => {
      const current = prev[courseId] || { faculty_ids: [], co_coordinator_id: null };
      const newFids = current.faculty_ids.filter((id) => id !== facultyId);
      let newCo = current.co_coordinator_id;
      if (newCo === facultyId) {
        newCo = newFids[0] || null;
      }
      return {
        ...prev,
        [courseId]: {
          faculty_ids: newFids,
          co_coordinator_id: newCo,
        },
      };
    });
  };

  const handleSetCoCoordinator = (courseId, facultyId) => {
    isDirtyRef.current = true;
    setMappings((prev) => {
      const current = prev[courseId] || { faculty_ids: [], co_coordinator_id: null };
      return {
        ...prev,
        [courseId]: {
          ...current,
          co_coordinator_id: facultyId,
        },
      };
    });
  };

  const handleSaveMapping = async (courseId) => {
    setSavingCourseId(courseId);
    try {
      const current = mappings[courseId] || { faculty_ids: [], co_coordinator_id: null };
      const payload = {
        course_id: courseId,
        faculty_ids: current.faculty_ids,
        co_coordinator_id: current.co_coordinator_id,
      };

      const res = await fetch('/api/mapping', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSavedMappings((prev) => ({
          ...prev,
          [courseId]: JSON.parse(JSON.stringify(current)),
        }));
        showToast('success', 'Mapping saved successfully');
      } else {
        const data = await res.json();
        showToast('error', data.error || 'Failed to save mapping');
      }
    } catch (e) {
      showToast('error', 'Network error');
    } finally {
      setSavingCourseId(null);
    }
  };

  const getFacultyName = (id) => {
    const f = faculties.find((item) => item.id === id);
    return f ? f.name : 'Unknown Faculty';
  };

  const isCourseDirty = (courseId) => {
    const current = mappings[courseId];
    const saved = savedMappings[courseId];
    if (!current && !saved) return false;
    return JSON.stringify(current) !== JSON.stringify(saved);
  };

  // Filter courses
  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      const matchSearch =
        !search.trim() ||
        c.course_code?.toLowerCase().includes(search.toLowerCase()) ||
        c.name?.toLowerCase().includes(search.toLowerCase());

      const matchSemester =
        semesterFilter === 'all' || String(c.semester) === semesterFilter;

      return matchSearch && matchSemester;
    });
  }, [courses, search, semesterFilter]);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#e2e8f0]">
        <div>
          <div className="text-[10px] font-bold tracking-[1.5px] text-[#4f46e5] uppercase mb-1.5 flex items-center gap-1.5">
            <IconArrowsShuffle size={14} />
            Academic Curriculum Delivery
          </div>
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#0f172a] leading-tight">
            Course–Faculty Mapping
          </h1>
          <p className="text-xs sm:text-[13px] text-[#64748b] mt-1 leading-relaxed">
            Assign up to 4 faculty members and designate co-coordinators for each semester course.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <RefreshButton onRefresh={() => fetchData(true)} lastUpdated={lastUpdated} label="Refresh" variant="default" />
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 bg-white border border-[#e2e8f0] rounded-[13px] shadow-xs">
        <div className="flex flex-1 items-center gap-2 max-w-md bg-[#f8fafc] border border-[#dbe1ea] rounded-lg px-3 py-1.5 focus-within:border-[#4f46e5] focus-within:ring-2 focus-within:ring-[#c7d2fe]">
          <IconSearch size={16} className="text-[#94a3b8] shrink-0" />
          <input
            type="text"
            className="w-full bg-transparent border-0 p-0 text-xs text-[#0f172a] placeholder-[#94a3b8] focus:outline-none"
            aria-label="Search courses by code or title"
            placeholder="Search courses by code or title…"
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

      {/* Courses List / Cards */}
      <div className="bg-white border border-[#e2e8f0] rounded-[13px] shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-[#64748b] flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-[#4f46e5] border-t-transparent rounded-full animate-spin"></span>
            <span>Loading courses and faculty mapping data…</span>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#94a3b8]">
            No courses found matching your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#edf0f5] bg-[#f8fafc] text-[10px] uppercase font-bold tracking-wider text-[#64748b]">
                  <th scope="col" className="py-3 px-4 w-[28%]">Course Code & Name</th>
                  <th scope="col" className="py-3 px-4 w-[10%]">Semester</th>
                  <th scope="col" className="py-3 px-4 w-[48%]">Assigned Faculty (Max 4)</th>
                  <th scope="col" className="py-3 px-4 w-[14%] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0f5]">
                {filteredCourses.map((c) => {
                  const current = mappings[c.id] || { faculty_ids: [], co_coordinator_id: null };
                  const assigned = current.faculty_ids;
                  const dirty = isCourseDirty(c.id);
                  const isSaving = savingCourseId === c.id;

                  // Unassigned available faculties for this course
                  const availableFaculties = faculties.filter((f) => !assigned.includes(f.id));

                  return (
                    <tr key={c.id} className="hover:bg-[#fafbfe] transition-colors">
                      {/* Course Info */}
                      <td className="py-4 px-4 align-top">
                        <div className="flex items-start gap-2.5">
                          <span className="w-7 h-7 rounded-lg bg-[#eff1ff] text-[#4f46e5] flex items-center justify-center shrink-0 mt-0.5">
                            <IconBook size={15} />
                          </span>
                          <div>
                            <span className="font-mono text-xs font-bold text-[#4f46e5]">
                              {c.course_code}
                            </span>
                            <div className="font-semibold text-[#0f172a] text-xs mt-0.5">
                              {c.name}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Semester */}
                      <td className="py-4 px-4 align-top">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-[#f8fafc] text-[#475569] border border-[#e2e8f0]">
                          Sem {c.semester}
                        </span>
                      </td>

                      {/* Assigned Faculty Chips & Selector */}
                      <td className="py-4 px-4 align-top">
                        <div className="space-y-3">
                          {/* Chips */}
                          <div className="flex flex-wrap items-center gap-2">
                            {assigned.map((fid) => {
                              const isCo = current.co_coordinator_id === fid;
                              return (
                                <div
                                  key={fid}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition-colors ${
                                    isCo
                                      ? 'bg-amber-50 text-amber-900 border-amber-200'
                                      : 'bg-[#eff1ff] text-[#4338ca] border-[#c7d2fe]'
                                  }`}
                                >
                                  {isCo && <IconCrown size={13} className="text-amber-600 shrink-0" />}
                                  <span className="font-medium">{getFacultyName(fid)}</span>

                                  {!isCo && (
                                    <button
                                      type="button"
                                      onClick={() => handleSetCoCoordinator(c.id, fid)}
                                      className="text-[10px] font-semibold text-[#64748b] hover:text-[#4338ca] underline ml-1 cursor-pointer"
                                      title="Designate as Co-coordinator"
                                    >
                                      Make Coordinator
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleRemoveFaculty(c.id, fid)}
                                    className="text-[#991b1b] hover:bg-red-100 rounded p-0.5 ml-1 transition-colors cursor-pointer"
                                    title="Remove assignment"
                                    aria-label={`Remove ${getFacultyName(fid)} from course`}
                                  >
                                    <IconX size={12} />
                                  </button>
                                </div>
                              );
                            })}

                            {assigned.length === 0 && (
                              <span className="text-xs text-[#94a3b8] italic">
                                No faculty assigned yet
                              </span>
                            )}
                          </div>

                          {/* Faculty Assignment Dropdown */}
                          {assigned.length < 4 ? (
                            <div className="flex items-center gap-2 max-w-xs">
                              <select
                                className="w-full text-xs py-1.5 px-2.5 border border-[#dbe1ea] rounded-md bg-white text-[#475569] focus:outline-none focus:border-[#4f46e5]"
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleSelectFaculty(c.id, parseInt(e.target.value, 10));
                                    e.target.value = '';
                                  }
                                }}
                                defaultValue=""
                                aria-label="Assign faculty member"
                              >
                                <option value="" disabled>+ Add Faculty</option>
                                {availableFaculties.map((f) => (
                                  <option key={f.id} value={f.id}>
                                    {f.name} ({f.email})
                                  </option>
                                ))}
                              </select>
                              {assigned.length > 0 && (
                                <span className="ml-2 text-xs text-[#64748b]">{assigned.length} of 4 assigned</span>
                              )}
                            </div>
                          ) : (
                            <div className="text-[11px] font-medium text-[#16a34a] flex items-center gap-1">
                              <IconCheck size={13} />
                              <span>Maximum 4 faculties assigned</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Action Button */}
                      <td className="py-4 px-4 align-top text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleSaveMapping(c.id)}
                          disabled={isSaving || !dirty}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                            dirty
                              ? 'bg-[#4f46e5] hover:bg-[#4338ca] text-white shadow-xs'
                              : 'bg-[#f1f5f9] text-[#94a3b8] border border-[#e2e8f0] cursor-default'
                          }`}
                        >
                          {isSaving ? (
                              <IconDeviceFloppy size={14} className="animate-spin" />
                            ) : (
                              dirty ? <IconDeviceFloppy size={14} /> : <IconCheck size={14} className="text-green-600" />
                            )}
                          <span>{isSaving ? 'Saving…' : dirty ? 'Save Mapping' : 'Saved'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
