'use client';
import PracticalGradeReport from '@/components/PracticalGradeReport';
import Editor from '@monaco-editor/react';

import { fetchCollection } from '@/lib/fetch-collection';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LoadingOverlay from '@/components/LoadingOverlay';
import { useSocket } from '@/hooks/useSocket';
import { usePolling } from '@/hooks/usePolling';
import { useFacultyAuth } from '@/hooks/useFacultyAuth';
import { PracticalList } from '@/features/practicals/components/PracticalList';
import { PracticalEditor } from '@/features/practicals/components/PracticalEditor';
import { PracticalDetailModal } from '@/features/practicals/components/PracticalDetailModal';
import { ExtraTimeDialog } from '@/features/practicals/components/ExtraTimeDialog';
import { usePracticalEditor } from '@/features/practicals/hooks/usePracticalEditor';
import {
  fetchCoursePracticals,
  fetchPracticalDetails,
  deletePractical as deletePracticalApi,
  grantExtraTime as grantExtraTimeApi,
} from '@/features/practicals/api/practicals-api';

export default function FacultyDashboard() {
  return <Suspense fallback={<p>Loading faculty workspace…</p>}><FacultyWorkspace /></Suspense>;
}

function FacultyWorkspace() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const socket = useSocket();
  const { token: authToken, isReady } = useFacultyAuth();
  const token = () => authToken || (typeof window !== 'undefined' ? localStorage.getItem('token') : '') || '';

  const [gradePractical, setGradePractical] = useState(null);
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);

  // Read browser preferences after the first render so server and client
  // render the same initial dashboard. Do not overwrite storage before restore.
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [activeTab, setActiveTab] = useState('practicals');

  useEffect(() => {
    const params = searchParams;
    const course = params.get('course') || localStorage.getItem('facultySelectedCourse') || '';
    const tab = params.get('tab') || localStorage.getItem('facultyActiveTab');
    setSelectedCourse(/^[1-9]\d*$/.test(course) ? course : '');
    setActiveTab(['practicals', 'submissions', 'marks'].includes(tab) ? tab : 'practicals');
    setPreferencesReady(true);
  }, [searchParams]);

  useEffect(() => {
    if (preferencesReady) localStorage.setItem('facultySelectedCourse', selectedCourse);
  }, [selectedCourse, preferencesReady]);

  useEffect(() => {
    if (preferencesReady) localStorage.setItem('facultyActiveTab', activeTab);
  }, [activeTab, preferencesReady]);

  // Practicals state
  const [practicals, setPracticals] = useState([]);
  const [loadingPracticals, setLoadingPracticals] = useState(false);
  const [viewingPractical, setViewingPractical] = useState(null);
  const [showViewPracticalModal, setShowViewPracticalModal] = useState(false);
  const [viewPracticalCodeLang, setViewPracticalCodeLang] = useState('python');
  const [extraTimePractical, setExtraTimePractical] = useState(null);

  // Submissions state
  const [selectedPracticalId, setSelectedPracticalId] = useState('');
  const [submissionCursor, setSubmissionCursor] = useState(null);
  const [nextSubmissionCursor, setNextSubmissionCursor] = useState(null);
  const submissionRequestVersion = useRef(0);
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState('in-time');
  const [submissionSortBy, setSubmissionSortBy] = useState('submission_time');
  const [submissionSortOrder, setSubmissionSortOrder] = useState('DESC');
  const [viewingSubmission, setViewingSubmission] = useState(null);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [copyCodeSuccess, setCopyCodeSuccess] = useState(false);

  // Live timer tick for real-time countdown
  // Keep rendering deterministic; initialise the clock after mount.
  const [currentTime, setCurrentTime] = useState(0);
  useEffect(() => {
    const tick = () => {
      setCurrentTime(Date.now());
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  // Department & Division filter state
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState('all');
  const [submissionDivisionFilter, setSubmissionDivisionFilter] = useState('all');

  // Marks Overview state
  const [selectedMarksPracticalId, setSelectedMarksPracticalId] = useState('');
  const [statsStudentCursor, setStatsStudentCursor] = useState(null);
  const [statsPracticalCursor, setStatsPracticalCursor] = useState(null);
  const statsRequestVersion = useRef(0);
  const statsRefresh = useRef(null);
  const [statsData, setStatsData] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // General Loading & Toast
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState(null);



  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // Auth guard handled by useFacultyAuth hook above — no duplicate needed here.

  // Gate initial data fetch on isReady (token available from localStorage)
  useEffect(() => {
    if (isReady) fetchContextData(true);
  }, [isReady]);

  const fetchContextData = async (isInitialLoad = false) => {
    const activeToken = token();
    if (!activeToken) return;
    if (isInitialLoad) setLoading(true);
    try {
      const [coursesRes, batchesRes] = await Promise.all([
        fetchCollection('/api/faculty/courses', { headers: { Authorization: `Bearer ${activeToken}` } }),
        fetchCollection('/api/faculty/batches', { headers: { Authorization: `Bearer ${activeToken}` } })
      ]);

      if (coursesRes) {
        const courseList = coursesRes;
        setCourses(courseList);
        setSelectedCourse(prev => {
          if (prev && courseList.some(c => c.id.toString() === prev.toString())) {
            return prev;
          }
          const stored = typeof window !== 'undefined' ? localStorage.getItem('facultySelectedCourse') : null;
          if (stored && courseList.some(c => c.id.toString() === stored.toString())) {
            return stored;
          }
          return '';
        });
      }
      if (batchesRes) {
        const batchList = batchesRes;
        setBatches(batchList);
        if (batchList.length > 0) {
          setSelectedBatch(batchList[0]);
        } else {
          setSelectedBatch('2024');
        }
      }
    } catch (e) {
      console.error(e);
      showToast('error', 'Error loading course or batch metadata.');
    } finally {
      if (isInitialLoad) setLoading(false);
    }
  };

  const practicalRequestVersion = useRef(0);
  const practicalCourse = useRef('');

  // Load practicals when selected course changes
  useEffect(() => {
    practicalCourse.current = selectedCourse;
    if (selectedCourse) fetchPracticals(true);
    else setLoadingPracticals(false);
    return () => {
      practicalCourse.current = '';
      practicalRequestVersion.current += 1;
    };
  }, [selectedCourse]);

  const fetchPracticals = async (showLoading = true) => {
    if (!selectedCourse || practicalCourse.current !== selectedCourse) return;
    const version = ++practicalRequestVersion.current;
    if (showLoading) setLoadingPracticals(true);
    try {
      const data = await fetchCoursePracticals(selectedCourse, token());
      if (version !== practicalRequestVersion.current) return;
      setPracticals(data);
      if (data.length > 0) {
        setSelectedPracticalId(prev => {
          if (prev && data.some(p => p.id.toString() === prev.toString())) return prev;
          return data[0].id.toString();
        });
        setSelectedMarksPracticalId(prev => {
          if (prev && data.some(p => p.id.toString() === prev.toString())) return prev;
          return data[0].id.toString();
        });
      } else {
        setSelectedPracticalId('');
        setSelectedMarksPracticalId('');
        setSubmissions([]);
        setStatsData(null);
      }
    } catch (e) {
      if (version === practicalRequestVersion.current) console.error(e);
    } finally {
      if (version === practicalRequestVersion.current) setLoadingPracticals(false);
    }
  };

  const practicalEditor = usePracticalEditor({
    selectedCourse,
    token,
    socket,
    showToast,
    onSaved: () => fetchPracticals(false),
    setProcessing,
  });

  // Load submissions
  useEffect(() => {
    if (selectedPracticalId && activeTab === 'submissions') {
      fetchSubmissions(true, null);
    }
  }, [selectedPracticalId, activeTab, studentSearch, submissionStatusFilter, submissionSortBy, submissionSortOrder, submissionDivisionFilter]);

  const fetchSubmissions = async (showLoading = true, cursor = submissionCursor) => {
    const version = ++submissionRequestVersion.current;
    if (showLoading) setLoadingSubmissions(true);
    try {
      let url = `/api/faculty/practicals/${selectedPracticalId}/submissions?studentSearch=${encodeURIComponent(studentSearch)}&status=${submissionStatusFilter}&sortBy=${submissionSortBy}&sortOrder=${submissionSortOrder}`;
      if (submissionDivisionFilter && submissionDivisionFilter !== 'all') {
        url += `&division=${encodeURIComponent(submissionDivisionFilter)}`;
      }
      if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (version !== submissionRequestVersion.current) return;
        setSubmissions(data);
        setSubmissionCursor(cursor);
        setNextSubmissionCursor(res.headers.get('X-Next-Cursor') || null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (version === submissionRequestVersion.current) setLoadingSubmissions(false);
    }
  };

  // Socket: 실시간 practical updates between faculty and co-coordinator
  useEffect(() => {
    if (!socket) return;

    const handlePracticalChanged = () => {
      if (selectedCourse) {
        fetchPracticals(false);
      }
    };

    socket.on('practical_added', handlePracticalChanged);
    socket.on('practical_updated', handlePracticalChanged);
    socket.on('practical_deleted', handlePracticalChanged);

    return () => {
      socket.off('practical_added', handlePracticalChanged);
      socket.off('practical_updated', handlePracticalChanged);
      socket.off('practical_deleted', handlePracticalChanged);
    };
  }, [socket, selectedCourse]);

  // Join course room when a course is selected
  useEffect(() => {
    if (!socket || !selectedCourse) return;
    socket.emit('join_course_room', selectedCourse);
    return () => {
      socket.emit('leave_course_room', selectedCourse);
    };
  }, [socket, selectedCourse]);

  // Socket: Submissions room for active practical
  useEffect(() => {
    if (!socket || !selectedPracticalId) return;

    socket.emit('join_practical_room', selectedPracticalId);

    // A new row can change sorting, filters and cursor boundaries.
    const handleNewSubmission = () => { fetchSubmissions(false); };

    socket.on('new_submission', handleNewSubmission);

    return () => {
      socket.off('new_submission', handleNewSubmission);
      socket.emit('leave_practical_room', selectedPracticalId);
    };
  }, [socket, selectedPracticalId, submissionCursor, studentSearch, submissionStatusFilter, submissionSortBy, submissionSortOrder, submissionDivisionFilter]);

  // Load stats
  useEffect(() => {
    if (selectedCourse && activeTab === 'marks') {
      fetchStats(true, null, null);
    }

    if (!socket || !selectedCourse || activeTab !== 'marks') return;

    const handleNewSubmissionMarks = () => {
      statsRefresh.current?.();
    };

    socket.on('new_submission_marks', handleNewSubmissionMarks);

    return () => {
      socket.off('new_submission_marks', handleNewSubmissionMarks);
    };
  }, [selectedCourse, activeTab, socket, selectedDepartmentFilter]);

  const fetchStats = async (showLoading = true, studentCursor = statsStudentCursor, practicalCursor = statsPracticalCursor) => {
    const version = ++statsRequestVersion.current;
    if (showLoading) setLoadingStats(true);
    try {
      const params = new URLSearchParams();
      if (studentCursor) params.set('studentCursor', studentCursor);
      if (practicalCursor) params.set('practicalCursor', practicalCursor);
      if (selectedDepartmentFilter !== 'all') params.set('department', selectedDepartmentFilter);
      const res = await fetch(`/api/faculty/courses/${selectedCourse}/stats?${params}`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (version !== statsRequestVersion.current) return;
        setStatsData(data); setStatsStudentCursor(studentCursor); setStatsPracticalCursor(practicalCursor);
      }
    } catch (e) { console.error(e); }
    finally { if (version === statsRequestVersion.current) setLoadingStats(false); }
  };

  useEffect(() => { statsRefresh.current = () => fetchStats(false); });

  // Background polling fallback (every 30s) - silent refresh so UI never flickers or resets
  usePolling(() => {
    if (selectedCourse && activeTab === 'practicals') {
      fetchPracticals(false);
    } else if (selectedPracticalId && activeTab === 'submissions') {
      fetchSubmissions(false);
    } else if (selectedCourse && activeTab === 'marks') {
      fetchStats(false);
    }
  }, 30_000, Boolean(selectedCourse));

  const handleOpenViewPractical = async (p) => {
    setProcessing(true);
    try {
      const data = await fetchPracticalDetails(p.id, token());
      let sampleCases = [];
      try {
        const parsed = JSON.parse(data.sample_input);
        if (Array.isArray(parsed) && parsed.length > 0) {
          sampleCases = parsed;
        } else {
          sampleCases = [{ input: data.sample_input || '', expected: data.sample_output || '' }];
        }
      } catch {
        sampleCases = [{ input: data.sample_input || '', expected: data.sample_output || '' }];
      }
      setViewingPractical({ ...data, sampleTestCases: sampleCases });
      const allowed = data.starter_code?.allowed_languages || ['python', 'cpp'];
      setViewPracticalCodeLang(allowed.includes('python') ? 'python' : (allowed[0] || 'python'));
      setShowViewPracticalModal(true);
    } catch (e) {
      showToast('error', e.message || 'Failed to retrieve practical details.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeletePractical = async (p) => {
    const promptMsg = p.submissions_count > 0
      ? `Practical "${p.title}" already has student submissions. Deleting it will mark it as INACTIVE so students can no longer access it, but submissions history will be preserved. Proceed?`
      : `Are you sure you want to permanently delete "${p.title}"?`;

    if (!confirm(promptMsg)) return;

    setProcessing(true);
    try {
      const data = await deletePracticalApi(p.id, token());
      showToast('success', data.message || 'Practical deleted successfully.');
      fetchPracticals();
      if (socket) {
        socket.emit('faculty_practical_deleted', {
          course_id: parseInt(selectedCourse),
          practicalId: p.id
        });
      }
    } catch (e) {
      showToast('error', e.message || 'Failed to delete practical.');
    } finally {
      setProcessing(false);
    }
  };

  const handleApplyExtraTime = async (minutes, customDate) => {
    if (!extraTimePractical) return;
    setProcessing(true);
    try {
      const payload = customDate
        ? { newEndTime: customDate }
        : { extraMinutes: minutes !== undefined ? minutes : 15 };

      const data = await grantExtraTimeApi(extraTimePractical.id, payload, token());
      showToast('success', data.message || 'Extra time granted successfully!');
      const practicalId = extraTimePractical.id;
      setExtraTimePractical(null);
      fetchPracticals();
      if (socket) {
        socket.emit('faculty_practical_updated', {
          course_id: parseInt(selectedCourse),
          practical: data.practical || { id: practicalId, course_id: parseInt(selectedCourse) }
        });
      }
    } catch (err) {
      showToast('error', err.message || 'Failed to grant extra time.');
    } finally {
      setProcessing(false);
    }
  };

  const handleViewSubmission = async (s) => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/faculty/submissions/${s.id}`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (res.ok) {
        const data = await res.json();
        let code = data.code || '';
        if (typeof code === 'string' && code.trim().length > 20 && code.trim().length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(code.trim())) {
          try {
            const decoded = atob(code.trim());
            if (btoa(decoded) === code.trim()) code = decoded;
          } catch {}
        }
        setViewingSubmission({ ...data, code });
        setShowSubmissionModal(true);
      } else {
          const errData = await res.text();
          console.error("Submission fetch failed:", errData);
          showToast('error', 'Error: ' + errData.substring(0, 50));
        }
    } catch (e) {
      showToast('error', 'Could not fetch submission details.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteSubmission = async (s) => {
    if (!confirm(`Are you sure you want to delete the submission for student "${s.student_name || 'Student'}" (Score: ${s.normalized_marks}/10)? This cannot be undone.`)) {
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch(`/api/faculty/submissions/${s.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      if (res.ok) {
        showToast('success', 'Submission deleted successfully.');
        setShowSubmissionModal(false);
        setViewingSubmission(null);
        fetchSubmissions();
        fetchPracticals();
        if (selectedCourse && activeTab === 'marks') fetchStats();
      } else {
        showToast('error', data.error || 'Failed to delete submission.');
      }
    } catch (e) {
      showToast('error', 'Network error deleting submission.');
    } finally {
      setProcessing(false);
    }
  };

  const handleExportCSV = () => {
    if (!statsData || !statsData.students || !statsData.practicals) {
      showToast('error', 'No data to export.');
      return;
    }

    const studentsToExport = selectedDepartmentFilter === 'all'
      ? statsData.students
      : statsData.students.filter(s => (s.department || '').toUpperCase() === selectedDepartmentFilter.toUpperCase());

    if (studentsToExport.length === 0) {
      showToast('error', 'No students found for the selected department.');
      return;
    }

    const headers = [
      'Roll Number', 'Student Name', 'Email', 'Department', 'Division',
      ...statsData.practicals.map((p, i) => `Practical ${i + 1} (${p.title})`)
    ];

    const marks = new Map(statsData.submissions.map(s => [`${s.student_id}:${s.practical_id}`, s]));
    const rows = studentsToExport.map(s => {
      const row = [s.roll_number || '—', s.name, s.email, s.department || '—', s.division || '—'];
      statsData.practicals.forEach(p => {
        const sub = marks.get(`${s.id}:${p.id}`);
        if (sub) {
          const lateSuffix = sub.is_late ? ' (Late)' : '';
          row.push(`${sub.normalized_marks}${lateSuffix}`);
        } else {
          row.push('Not Submitted');
        }
      });
      return row;
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const courseCodeStr = statsData.course?.course_code || 'course';
    const deptSuffix = selectedDepartmentFilter === 'all' ? 'All_Departments' : selectedDepartmentFilter.replace(/\s+/g, '_');
    link.setAttribute('download', `${courseCodeStr.replace(/\s+/g, '_')}_${deptSuffix}_grades_matrix_page.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!selectedCourse) {
    return (
      <div style={{ position: 'relative', minHeight: '80vh', padding: '20px' }}>
        {processing && <LoadingOverlay />}

        {/* Toast Alert */}
        {toast && (
          <div style={{
            position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
            padding: '14px 20px', borderRadius: '10px', fontWeight: 600, fontSize: '14px',
            backgroundColor: toast.type === 'success' ? '#eff1ff' : '#fef2f2',
            color: toast.type === 'success' ? '#4338ca' : '#991b1b',
            border: `1px solid ${toast.type === 'success' ? '#c7d2fe' : '#fca5a5'}`,
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)'
          }}>
            {toast.msg}
          </div>
        )}

        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '8px' }}>Select Allocated Subject</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14.5px', marginBottom: '30px' }}>Choose a course below to manage its assignments, view student grades, and download spreadsheets.</p>
        </div>

        <div className="faculty-course-grid">
          {courses.map(c => (
            <div
              className="faculty-course-card" role="button" tabIndex={0}
              onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedCourse(c.id.toString()); } }}
              key={c.id}
              onClick={() => setSelectedCourse(c.id.toString())}
              style={{
                background: 'white', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px',
                cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '160px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
                e.currentTarget.style.borderColor = 'var(--primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)';
                e.currentTarget.style.borderColor = 'var(--border-color)';
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{c.course_code}</span>
                  {c.is_co_coordinator ? (
                    <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#eff1ff', color: '#475569', border: '1px solid #c7d2fe', padding: '2px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      👑 Co-coordinator
                    </span>
                  ) : (
                    <span style={{ fontSize: '11px', fontWeight: 600, backgroundColor: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      👁 View-only
                    </span>
                  )}
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, marginTop: '8px', color: '#1e293b' }}>{c.name}</h3>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#64748b' }}>
                <span>Semester {c.semester}</span>
                <span style={{ fontWeight: 600, color: 'var(--primary)' }}>Manage &rarr;</span>
              </div>
            </div>
          ))}
          {courses.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              No allocated courses found for your faculty account.
            </div>
          )}
        </div>
      </div>
    );
  }

  const activeCourse = courses.find(c => c.id.toString() === selectedCourse);

  return (
    <div style={{ position: 'relative', minHeight: '80vh' }}>
      {processing && <LoadingOverlay />}

      {/* Toast Alert */}
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
          padding: '14px 20px', borderRadius: '10px', fontWeight: 600, fontSize: '14px',
          backgroundColor: toast.type === 'success' ? '#eff1ff' : '#fef2f2',
          color: toast.type === 'success' ? '#4338ca' : '#991b1b',
          border: `1px solid ${toast.type === 'success' ? '#c7d2fe' : '#fca5a5'}`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)'
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header Selector Context */}
      <div className="header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>
            {activeCourse?.course_code}
          </span>
          <h2 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-main)', marginTop: '4px' }}>
            {activeCourse?.name}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
            {activeCourse?.is_co_coordinator ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                backgroundColor: '#eff1ff', border: '1px solid #c7d2fe',
                color: '#475569', fontSize: '12px', fontWeight: 700,
                padding: '4px 10px', borderRadius: '20px'
              }}>
                👑 Co-coordinator &nbsp;·&nbsp; Can add / edit / delete practicals
              </span>
            ) : (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1',
                color: '#64748b', fontSize: '12px', fontWeight: 600,
                padding: '4px 10px', borderRadius: '20px'
              }}>
                 View-only Access &nbsp;·&nbsp; Contact admin to assign co-coordinator rights
              </span>
            )}
          </div>
        </div>

        <div>
          <button
            onClick={() => setSelectedCourse('')}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)',
              backgroundColor: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '13px'
            }}
          >
            🔄 Switch Subject
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="faculty-tabs" role="group" aria-label="Course workspace views">
        <button
          aria-pressed={activeTab === 'practicals'}
          onClick={() => setActiveTab('practicals')}
          style={{
            padding: '12px 24px', background: 'none', border: 'none', borderBottom: activeTab === 'practicals' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'practicals' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', fontSize: '15px'
          }}
        >
           Practicals List
        </button>
        <button
          aria-pressed={activeTab === 'submissions'}
          onClick={() => setActiveTab('submissions')}
          style={{
            padding: '12px 24px', background: 'none', border: 'none', borderBottom: activeTab === 'submissions' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'submissions' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', fontSize: '15px'
          }}
        >
          📥 Student Submissions
        </button>
        <button
          aria-pressed={activeTab === 'marks'}
          onClick={() => setActiveTab('marks')}
          style={{
            padding: '12px 24px', background: 'none', border: 'none', borderBottom: activeTab === 'marks' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'marks' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', fontSize: '15px'
          }}
        >
           Marks Overview
        </button>
      </div>

      {/* TAB 1: PRACTICALS LIST */}
      {activeTab === 'practicals' && (
        <PracticalList
          practicals={practicals}
          loading={loadingPracticals}
          activeCourse={activeCourse}
          currentTime={currentTime}
          onAddPractical={practicalEditor.handleOpenAddPractical}
          onViewPractical={handleOpenViewPractical}
          onEditPractical={practicalEditor.handleOpenEditPractical}
          onDeletePractical={handleDeletePractical}
          onExtraTime={setExtraTimePractical}
          onGrades={setGradePractical}
        />
      )}

      {/* TAB 2: STUDENT SUBMISSIONS */}
      {gradePractical && <PracticalGradeReport key={gradePractical.id} practical={gradePractical} token={token()} onClose={() => setGradePractical(null)} />}
      {activeTab === 'submissions' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '15px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '300px' }}>
              <select
                value={selectedPracticalId}
                onChange={e => setSelectedPracticalId(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'white', minWidth: '200px' }}
              >
                {practicals.map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
                {practicals.length === 0 && <option value="">No practicals available</option>}
              </select>

              {selectedPracticalId && (
                <button
                  type="button"
                  onClick={() => {
                    const found = practicals.find(p => p.id === parseInt(selectedPracticalId));
                    if (found) setExtraTimePractical(found);
                  }}
                  style={{
                    padding: '8px 14px', borderRadius: '6px', border: '1px solid #bfdbfe',
                    backgroundColor: '#eff1ff', color: '#1d4ed8', cursor: 'pointer',
                    fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap'
                  }}
                  title="Add extra time for this practical"
                >
                  ⏰ Grant Extra Time
                </button>
              )}

              <input
                type="text"
                placeholder="Search Student, Roll No, Division..."
                className="input-field"
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
                style={{ maxWidth: '260px', padding: '8px 12px' }}
              />

              <select
                value={submissionDivisionFilter}
                onChange={e => setSubmissionDivisionFilter(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'white', fontSize: '13px' }}
              >
                <option value="all">All Divisions</option>
                {Array.from(new Set(submissions.map(s => s.division).filter(Boolean))).sort().map(div => (
                  <option key={div} value={div}>Div: {div}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <select
                value={submissionStatusFilter}
                onChange={e => setSubmissionStatusFilter(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'white' }}
              >
                <option value="in-time">In-Time Submission</option>
                <option value="late">Late Submission</option>
              </select>

              <select
                value={submissionSortBy}
                onChange={e => setSubmissionSortBy(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'white' }}
              >
                <option value="submission_time">Submission Time</option>
                <option value="marks">Marks</option>
                <option value="student_name">Student Name</option>
              </select>

              <select
                value={submissionSortOrder}
                onChange={e => setSubmissionSortOrder(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'white' }}
              >
                <option value="DESC">Descending</option>
                <option value="ASC">Ascending</option>
              </select>
            </div>
          </div>

          <div className="table-container" style={{ marginTop: '15px' }}>
            {loadingSubmissions ? <p>Loading submissions...</p> : (
              <table>
                <thead>
                  <tr>
                    <th scope="col">Roll Number</th>
                    <th scope="col">Student Name</th>
                    <th scope="col">Division</th>
                    <th scope="col">Submission Time</th>
                    <th scope="col">Language</th>
                    <th scope="col">Status</th>
                    <th scope="col">Raw Score</th>
                    <th scope="col">Normalized Score (Out of 10)</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{s.roll_number || '—'}</td>
                      <td style={{ fontWeight: 500 }}>{s.student_name}</td>
                      <td>
                        <span style={{ fontSize: '12px', fontWeight: 600, backgroundColor: '#eff1ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px' }}>
                          {s.division || '—'}
                        </span>
                      </td>
                      <td>{new Date(s.submitted_at).toLocaleString()}</td>
                      <td>{s.language.toUpperCase()}</td>
                      <td>
                        <span style={{
                          padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                          backgroundColor: s.is_late ? '#fef2f2' : '#eff1ff',
                          color: s.is_late ? '#b91c1c' : '#4f46e5'
                        }}>
                          {s.is_late ? 'Late' : 'In-Time'}
                        </span>
                      </td>
                      <td>{s.raw_marks} Marks</td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{s.normalized_marks} / 10</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            onClick={() => handleViewSubmission(s)}
                            style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', backgroundColor: '#475569', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
                          >
                             View Details
                          </button>
                          {activeCourse?.is_co_coordinator && (
                            <button
                              onClick={() => handleDeleteSubmission(s)}
                              style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', backgroundColor: '#b91c1c', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
                              title="Delete this student submission"
                            >
                               Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {submissions.length === 0 && (
                    <tr><td colSpan="9" style={{ textAlign: 'center', color: '#888', padding: '40px' }}>No student submissions found.</td></tr>
                  )}
                </tbody>
              </table>
            )}
            <div style={{display: 'flex', gap: 12, padding: 16}}>
              <button disabled={loadingSubmissions || !submissionCursor} onClick={() => fetchSubmissions(true, null)}>First page</button>
              <span>{submissions.length} submissions on this page</span>
              <button disabled={loadingSubmissions || !nextSubmissionCursor} onClick={() => fetchSubmissions(true, nextSubmissionCursor)}>Next page</button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MARKS OVERVIEW */}
      {activeTab === 'marks' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '15px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Grades Matrix (Pivot View)</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Grid layout showing each student's score across all active course practicals.</p>
            </div>

            {statsData && (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Department:</label>
                  <select
                    value={selectedDepartmentFilter}
                    onChange={e => setSelectedDepartmentFilter(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'white', fontSize: '13px', fontWeight: 600 }}
                  >
                    <option value="all">All Departments</option>
                    {(statsData.departments || []).filter(d => d.department).map(d => (
                      <option key={d.department} value={d.department}>{d.department} ({d.count})</option>
                    ))}
                  </select>
                </div>

                <button
                  className="btn-primary"
                  style={{ width: 'auto', padding: '10px 18px', backgroundColor: '#4f46e5', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={handleExportCSV}
                >
                  ⬆ Export Current Page (CSV)
                </button>
              </div>
            )}
          </div>

          {loadingStats ? <p>Loading marks matrix...</p> : statsData && statsData.practicals && (() => {
            const marks = new Map(statsData.submissions.map(s => [`${s.student_id}:${s.practical_id}`, s]));
            const filteredStatsStudents = (statsData.students || []).filter(s => {
              if (selectedDepartmentFilter === 'all') return true;
              return (s.department || '').toUpperCase() === selectedDepartmentFilter.toUpperCase();
            });

            return (
              <div>
                <div style={{display: 'flex', gap: 12, flexWrap: 'wrap'}}>
                  <button disabled={!statsStudentCursor} onClick={() => fetchStats(true, null, statsPracticalCursor)}>First student page</button>
                  <button disabled={!statsData.pagination?.studentCursor} onClick={() => fetchStats(true, statsData.pagination.studentCursor, statsPracticalCursor)}>Next students</button>
                  <button disabled={!statsPracticalCursor} onClick={() => fetchStats(true, statsStudentCursor, null)}>First practical page</button>
                  <button disabled={!statsData.pagination?.practicalCursor} onClick={() => fetchStats(true, statsStudentCursor, statsData.pagination.practicalCursor)}>Next practicals</button>
                  <span>{statsData.students.length} students × {statsData.practicals.length} practicals on this page</span>
                </div>
                <div className="table-container" style={{ overflowX: 'auto', marginTop: '15px' }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ minWidth: '120px' }}>Roll Number</th>
                        <th style={{ minWidth: '170px' }}>Student Name</th>
                        <th style={{ minWidth: '110px' }}>Department</th>
                        <th style={{ minWidth: '90px' }}>Division</th>
                        {statsData.practicals.map((p, idx) => (
                          <th key={p.id} style={{ textAlign: 'center', minWidth: '120px' }}>
                            Prac {idx + 1}
                            <div style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--text-muted)', marginTop: '4px' }}>
                              {p.title.length > 20 ? p.title.substring(0, 18) + '..' : p.title}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStatsStudents.map(s => (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{s.roll_number || '—'}</td>
                          <td style={{ fontWeight: 500 }}>{s.name}</td>
                          <td>
                            <span style={{ fontSize: '12px', fontWeight: 600, backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>
                              {s.department || '—'}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: '12px', fontWeight: 600, backgroundColor: '#eff1ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px' }}>
                              {s.division || '—'}
                            </span>
                          </td>
                          {statsData.practicals.map(p => {
                            const sub = marks.get(`${s.id}:${p.id}`);
                            return (
                              <td key={p.id} style={{ textAlign: 'center' }}>
                                {sub ? (
                                  <div>
                                    <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{sub.normalized_marks} / 10</span>
                                    {sub.is_late && (
                                      <span style={{
                                        display: 'block', fontSize: '9px', fontWeight: 'bold', color: '#b91c1c', marginTop: '2px'
                                      }}>
                                        LATE
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic' }}>Not Submitted</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {filteredStatsStudents.length === 0 && (
                        <tr>
                          <td colSpan={statsData.practicals.length + 4} style={{ textAlign: 'center', color: '#888', padding: '40px' }}>
                            No students found for department "{selectedDepartmentFilter}".
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* MODAL: ADD / EDIT PRACTICAL */}
      <PracticalEditor
        isOpen={practicalEditor.showPracticalModal}
        editingPractical={practicalEditor.editingPractical}
        formData={practicalEditor.formData}
        formHandlers={practicalEditor.formHandlers}
        processing={processing}
        onSubmit={practicalEditor.handleSubmitPractical}
        onClose={() => practicalEditor.setShowPracticalModal(false)}
      />

      {/* MODAL: VIEW PRACTICAL DETAILS (READ-ONLY) */}
      {showViewPracticalModal && viewingPractical && (
        <PracticalDetailModal
          practical={viewingPractical}
          activeCourse={activeCourse}
          currentTime={currentTime}
          codeLang={viewPracticalCodeLang}
          onChangeCodeLang={setViewPracticalCodeLang}
          onClose={() => setShowViewPracticalModal(false)}
          onEdit={(p) => {
            setShowViewPracticalModal(false);
            practicalEditor.handleOpenEditPractical(p);
          }}
        />
      )}

      {/* MODAL: VIEW SUBMISSION CODE & CASE RESULTS */}
      {showSubmissionModal && viewingSubmission && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '32px',
            width: '100%', maxWidth: '850px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            <h3 style={{ marginBottom: '20px', fontSize: '20px', fontWeight: 700 }}>
              Submission Details - {viewingSubmission.student_name}
            </h3>

            <div style={{ display: 'flex', gap: '20px', backgroundColor: '#f8fafc', padding: '15px', borderRadius: '10px', marginBottom: '20px' }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Roll Number: <strong>{viewingSubmission.roll_number || '—'}</strong></p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', mt: '5px' }}>Language: <strong>{(viewingSubmission.language || 'txt').toUpperCase()}</strong></p>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Status: <strong style={{ color: viewingSubmission.status === 'Accepted' ? '#4f46e5' : '#b91c1c' }}>{viewingSubmission.status}</strong></p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', mt: '5px' }}>Submitted: <strong>{new Date(viewingSubmission.submitted_at).toLocaleString()}</strong></p>
              </div>
              <div style={{ flex: 1, textAlign: 'right' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Score:</p>
                <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)' }}>{viewingSubmission.normalized_marks} / 10</p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(Raw Marks: {viewingSubmission.raw_marks} / {viewingSubmission.practical_total_marks})</p>
              </div>
            </div>

            {/* Source code block */}
            <div style={{ marginBottom: '25px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>Submitted Raw Code:</h4>
                  <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#e2e8f0', color: '#334155', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                    {viewingSubmission.language}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    ({viewingSubmission.code ? viewingSubmission.code.split('\n').length : 0} lines)
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (viewingSubmission?.code) {
                        navigator.clipboard.writeText(viewingSubmission.code);
                        setCopyCodeSuccess(true);
                        setTimeout(() => setCopyCodeSuccess(false), 2500);
                      }
                    }}
                    style={{
                      padding: '5px 12px', borderRadius: '6px', border: '1px solid #cbd5e1',
                      backgroundColor: copyCodeSuccess ? '#eff1ff' : '#ffffff',
                      color: copyCodeSuccess ? '#059669' : '#1e293b',
                      fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '5px'
                    }}
                  >
                    {copyCodeSuccess ? '✓ Copied!' : ' Copy Raw Code'}
                  </button>
                </div>
              </div>
              <div style={{ height: '380px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #1e293b' }}><Editor height="100%" language={(viewingSubmission.language || 'txt') === 'c' || (viewingSubmission.language || 'txt') === 'cpp' ? 'cpp' : viewingSubmission.language} theme="light" value={viewingSubmission.code} options={{ readOnly: true, minimap: { enabled: false }, scrollBeyondLastLine: false, fontSize: 13, fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace' }} /></div>
            </div>

            {/* Test case analysis */}
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px' }}>Test Cases evaluation breakdown:</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(viewingSubmission.cases || []).map((c, i) => (
                  <div key={c.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>{c.label || `Test Case ${i + 1}`} {c.is_hidden ? ' (Hidden)' : ''}</span>
                      <span style={{
                        padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                        backgroundColor: c.passed ? '#eff1ff' : '#fef2f2',
                        color: c.passed ? '#4f46e5' : '#b91c1c'
                      }}>
                        {c.passed ? 'PASSED' : 'FAILED'} (+{c.marks_awarded} marks)
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', fontSize: '12px', background: '#f8fafc', padding: '8px', borderRadius: '6px' }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Input:</span>
                        <pre style={{ margin: '3px 0 0 0', fontFamily: 'monospace', background: 'white', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>{c.input}</pre>
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Expected:</span>
                        <pre style={{ margin: '3px 0 0 0', fontFamily: 'monospace', background: 'white', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>{c.expected}</pre>
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Actual Output:</span>
                        <pre style={{
                          margin: '3px 0 0 0', fontFamily: 'monospace', background: 'white', padding: '4px', borderRadius: '4px',
                          border: '1px solid var(--border-color)', color: c.passed ? '#4f46e5' : '#b91c1c'
                        }}>{c.actual_output || '—'}</pre>
                      </div>
                    </div>

                    {c.error_message && (
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#b91c1c', backgroundColor: '#fef2f2', padding: '8px', borderRadius: '6px', fontFamily: 'monospace' }}>
                        <strong>Error output:</strong><br/>
                        {c.error_message}
                      </div>
                    )}
                  </div>
                ))}
                {(!viewingSubmission.cases || viewingSubmission.cases.length === 0) && (
                  <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', color: '#64748b', fontSize: '13px', fontStyle: 'italic', textAlign: 'center' }}>
                    No individual test case evaluation records found for this submission.
                  </div>
                )}
              </div>
            </div>

            {/* Modal action */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
              {activeCourse?.is_co_coordinator ? (
                <button
                  type="button"
                  onClick={() => handleDeleteSubmission(viewingSubmission)}
                  style={{ padding: '10px 18px', backgroundColor: '#b91c1c', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
                >
                   Delete Submission
                </button>
              ) : <div />}
              <button
                onClick={() => setShowSubmissionModal(false)}
                style={{ padding: '10px 24px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                Close Submission Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: GRANT EXTRA TIME */}
      {extraTimePractical && (
        <ExtraTimeDialog
          practical={extraTimePractical}
          currentTime={currentTime}
          processing={processing}
          onApply={handleApplyExtraTime}
          onClose={() => setExtraTimePractical(null)}
        />
      )}
    </div>
  );
}

