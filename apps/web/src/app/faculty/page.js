'use client';
import { useSubmissionReview } from '@/features/submissions/hooks/useSubmissionReview';
import { useMarksOverview } from '@/features/reports/hooks/useMarksOverview';
import { SubmissionDetailDialog } from '@/features/submissions/components/SubmissionDetailDialog';
import { MarksOverview } from '@/features/reports/components/MarksOverview';
import { SubmissionReview } from '@/features/submissions/components/SubmissionReview';
import PracticalGradeReport from '@/features/reports/components/PracticalGradeReport';

import { fetchCollection } from '@/lib/fetch-collection';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import { useSocket } from '@/hooks/useSocket';
import { usePolling } from '@/hooks/usePolling';
import { useFacultyAuth } from '@/features/auth/hooks/useFacultyAuth';
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
    setGradePractical(null);
    setSelectedPracticalId('');
    setPracticals([]);
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
      } else {
        setSelectedPracticalId('');
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

  const reports = useMarksOverview({ selectedCourse, activeTab, token, socket, showToast });
  const review = useSubmissionReview({ selectedCourse, selectedPracticalId, activeTab, token, socket, showToast, fetchPracticals, fetchStats: reports.fetchStats });

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

  // Background polling fallback (every 30s) - silent refresh so UI never flickers or resets
  usePolling(() => {
    if (selectedCourse && activeTab === 'practicals') {
      fetchPracticals(false);
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

  if (!selectedCourse) {
    return (
      <div style={{ position: 'relative', minHeight: '80vh', padding: '20px' }}>
        {(processing || review.reviewProcessing) && <LoadingOverlay />}

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
      {(processing || review.reviewProcessing) && <LoadingOverlay />}

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
      <SubmissionReview
          {...review}
          selectedPracticalId={selectedPracticalId}
          setSelectedPracticalId={setSelectedPracticalId}
          practicals={practicals}
          setExtraTimePractical={setExtraTimePractical}
          activeCourse={activeCourse}
        />
      )}

      {/* TAB 3: MARKS OVERVIEW */}
      {activeTab === 'marks' && (
      <MarksOverview {...reports} />
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
      <SubmissionDetailDialog {...review} activeCourse={activeCourse} />

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

