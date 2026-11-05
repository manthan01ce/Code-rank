'use client';
import { createRequestScope } from '@/lib/http-client';
import { mappingRequest } from '../api/mapping-api';

import { useState, useEffect, useRef, useMemo } from 'react';
import { fetchCollection } from '@/lib/fetch-collection';
import { fetchUserOptions } from '@/lib/fetch-user-options';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import { useAdminAuth } from '@/features/auth/hooks/useAdminAuth';
import { usePolling } from '@/hooks/usePolling';
import RefreshButton from '@/components/ui/RefreshButton';
import {
  IconSearch,
  IconCheck,
  IconCrown,
  IconUserPlus,
  IconX,
  IconBook,
  IconDeviceFloppy,
} from '@tabler/icons-react';

export function useCourseMapping() {
  const [listRequests] = useState(createRequestScope);
  useEffect(() => () => listRequests.cancel(), [listRequests]);
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
    const request = listRequests.begin();
    if (isInitial) setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${authToken}` };

      const [cRes, fRes, mRes] = await Promise.all([
        fetchCollection('/api/courses', { headers, signal: request.signal }),
        fetchUserOptions('/api/users?role=faculty&status=active', { headers, signal: request.signal }),
        mappingRequest( { headers, signal: request.signal }),
      ]);

      if (!request.isCurrent()) return;
      setCourses(cRes);
      setFaculties(fRes);
      if (mRes.ok) {
        const mappingData = await mRes.json();
        if (!request.isCurrent()) return;
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
      if (!request.isCurrent()) return;
      console.error(e);
      if (isInitial) showToast('error', 'Error loading course mappings');
    } finally {
      if (isInitial && request.isCurrent()) setLoading(false);
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

      const res = await mappingRequest( {
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


  return { courses, setCourses, faculties, setFaculties, mappings, setMappings, savedMappings, setSavedMappings, savingCourseId, setSavingCourseId, loading, setLoading, processing, setProcessing, search, setSearch, semesterFilter, setSemesterFilter, toast, setToast, lastUpdated, setLastUpdated, isDirtyRef, showToast, authToken, isReady, fetchData, handleSelectFaculty, handleRemoveFaculty, handleSetCoCoordinator, handleSaveMapping, getFacultyName, isCourseDirty, filteredCourses };
}
